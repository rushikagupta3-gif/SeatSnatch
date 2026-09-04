import { nanoid } from "nanoid";
import { inventoryStore } from "./inventoryStore.js";
import { evaluateOffer, decideAction } from "./scoring.js";
import { createEscrow, finishEscrow, FINISH_AFTER_BUFFER_SECONDS } from "../xrpl/escrow.js";
import { sendIOU } from "../xrpl/rlusd.js";
import { sendXRPPayment } from "../xrpl/payment.js";
import { loadDemoWallets } from "./walletRegistry.js";
import { encodePaymentProof } from "./x402.js";
import { TESTNET_EXPLORER_TX } from "../xrpl/client.js";
import { toUSD } from "./scoring.js";
import { cabinMultiplier } from "../data/airlines.js";
import { getPassengerForBooking, hasCompleteProfile } from "./passenger.js";
import { db } from "../db/db.js";

// Mock FX rate for demo purposes only — not a real market rate. Chosen so
// typical fare prices ($400-700) map to XRP amounts well within a single
// faucet-funded testnet wallet's balance (faucet grants ~100 XRP).
export const MOCK_XRP_USD_RATE = 50;

const POLL_INTERVAL_MS = 2500;
const MIN_CONFIDENCE_POLLS = 2; // let depletion rate become readable before acting
const XRPL_CALL_TIMEOUT_MS = 20000;
const PRICE_WATCH_INTERVAL_MS = 4000;
const PRICE_WATCH_MAX_TICKS = 30; // ~2min of post-booking price watching, then gives up
const MIN_REFUNDABLE_DROP_USD = 1;

// Two legs can submit concurrent XRPL requests over the shared testnet
// connection; if one ever stalls (network hiccup, congested ledger), this
// stops it from silently hanging a leg forever — it errors out, gets
// caught by the leg's own error handler, and the leg resumes monitoring so
// it can retry rather than freezing the whole demo.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

const sessions = new Map();

function log(session, type, message, data = {}, leg = null) {
  const entry = { id: nanoid(8), t: Date.now(), type, message, data, leg };
  session.log.push(entry);
  broadcast(session, entry);
  return entry;
}

function broadcast(session, entry) {
  for (const res of session.sseClients) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }
}

export function getSession(id) {
  return sessions.get(id);
}

export function attachSSEClient(sessionId, res) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.sseClients.add(res);
  return true;
}

export function detachSSEClient(sessionId, res) {
  const session = sessions.get(sessionId);
  session?.sseClients.delete(res);
}

/** Total USD already committed by booked legs — the live combined-spend guard reads this. */
export function combinedSpentUSD(session, excludeLeg = null) {
  return Object.entries(session.legs)
    .filter(([key, leg]) => leg && key !== excludeLeg && leg.ticketPriceUSD != null)
    .reduce((sum, [, leg]) => sum + leg.ticketPriceUSD, 0);
}

function serializeLeg(leg) {
  if (!leg) return null;
  return {
    status: leg.status,
    pollCount: leg.pollCount,
    lastEvaluations: leg.lastEvaluations,
    ticket: leg.ticket,
    ticketPriceUSD: leg.ticketPriceUSD,
    refund: leg.refund,
  };
}

export function serializeSession(session) {
  return {
    id: session.id,
    objective: session.objective,
    status: session.status,
    escrow: session.escrow
      ? {
          ...session.escrow,
          explorerUrl: TESTNET_EXPLORER_TX(session.escrow.hash),
        }
      : null,
    wallets: {
      traveller: session.wallets.traveller.address,
      agent: session.wallets.agent.address,
      airline: session.wallets.airline.address,
    },
    legs: {
      outbound: serializeLeg(session.legs.outbound),
      return: serializeLeg(session.legs.return),
    },
    combinedSpentUSD: combinedSpentUSD(session),
    log: session.log,
  };
}

function newLegState() {
  return {
    status: "monitoring",
    pollCount: 0,
    lastEvaluations: [],
    ticket: null,
    ticketPriceUSD: null,
    timer: null,
    priceWatchTimer: null,
    refund: null,
  };
}

export async function startSession(objective, userId) {
  if (!hasCompleteProfile(userId)) {
    const err = new Error("Complete your passenger profile (including passport details) before booking.");
    err.status = 412;
    throw err;
  }

  const wallets = loadDemoWallets();
  const id = nanoid(10);
  const isRoundTrip = objective.tripType === "round-trip";

  const session = {
    id,
    userId,
    objective,
    status: "initializing",
    wallets,
    escrow: null,
    legEscrows: {},
    legs: {
      outbound: newLegState(),
      return: isRoundTrip ? newLegState() : null,
    },
    log: [],
    sseClients: new Set(),
  };
  sessions.set(id, session);

  const routeMsg = isRoundTrip
    ? `Session started: ${objective.origin} → ${objective.destination} (round-trip, return ${objective.returnDate}), max $${objective.maxPrice} combined`
    : `Session started: ${objective.origin} → ${objective.destination}, max $${objective.maxPrice}`;
  log(session, "info", routeMsg);

  if (objective.cabinClass && objective.cabinClass !== "economy") {
    log(session, "info", `Cabin class: ${objective.cabinClass} (${cabinMultiplier(objective.cabinClass)}x economy fare).`);
  }
  if (objective.preferredAirlines?.length) {
    log(session, "info", `Restricted to airlines: ${objective.preferredAirlines.join(", ")}.`);
  }
  if (objective.notes?.trim()) {
    log(session, "info", `Traveller notes: "${objective.notes.trim()}"`);
  }

  const amountXrp = (objective.maxPrice / MOCK_XRP_USD_RATE).toFixed(2);
  log(session, "escrow", `Locking pre-authorized budget: ${amountXrp} XRP (~$${objective.maxPrice}) via EscrowCreate...`);

  try {
    const escrow = await createEscrow({
      fromWallet: wallets.traveller.wallet,
      destinationAddress: wallets.airline.address,
      amountXrp,
      cancelAfterSeconds: 3600,
    });
    session.escrow = escrow;
    log(session, "escrow", `Escrow created — combined budget locked on XRPL Testnet.`, {
      hash: escrow.hash,
      explorerUrl: TESTNET_EXPLORER_TX(escrow.hash),
      amountXrp,
    });
  } catch (err) {
    session.status = "failed";
    log(session, "error", `Escrow creation failed: ${err.message}`);
    return session;
  }

  session.status = "monitoring";
  log(session, "info", "Agent monitoring loop started — evaluating fares every 2.5s.");

  session.legs.outbound.timer = setInterval(
    () => tickLeg(session, "outbound").catch((err) => log(session, "error", err.message, {}, "outbound")),
    POLL_INTERVAL_MS
  );
  if (isRoundTrip) {
    session.legs.return.timer = setInterval(
      () => tickLeg(session, "return").catch((err) => log(session, "error", err.message, {}, "return")),
      POLL_INTERVAL_MS
    );
  }

  return session;
}

function preferences(session) {
  return {
    hourlyLayoverCost: session.objective.hourlyLayoverCost,
    riskDollarValue: session.objective.riskDollarValue,
    cabinClass: session.objective.cabinClass,
    preferredAirlines: session.objective.preferredAirlines,
  };
}

async function tickLeg(session, legKey) {
  const legState = session.legs[legKey];
  if (!legState || legState.status !== "monitoring") return;
  legState.pollCount += 1;

  const offers = inventoryStore.list(legKey);
  const budgetCap = session.objective.maxPrice - combinedSpentUSD(session, legKey);
  const prefs = preferences(session);

  const evaluations = offers.map((offer) => evaluateOffer(offer, inventoryStore.getHistory(offer.id), prefs, budgetCap));
  legState.lastEvaluations = evaluations;

  for (const e of evaluations) {
    const projection =
      e.depletion.projectedSelloutSeconds != null
        ? `sellout in ~${Math.round(e.depletion.projectedSelloutSeconds)}s`
        : "no depletion trend yet";
    const airlineNote = e.airlineAllowed ? "" : " (excluded — airline not selected)";
    log(
      session,
      "evaluation",
      `${e.offerId} ${e.airline.code}${e.flightNumber.slice(2)}: ${e.availabilityCode}, expected cost $${e.expectedCost}, ${projection}${airlineNote}`,
      e,
      legKey
    );
  }

  const { action, target, reason } = decideAction(evaluations, { pollCount: legState.pollCount, minConfidencePolls: MIN_CONFIDENCE_POLLS });

  if (action === "ALERT_USER") {
    log(
      session,
      "alert",
      reason === "no-inventory"
        ? "No fares found for this leg."
        : `No fare fits current budget/airline constraints (remaining budget for this leg: $${budgetCap.toFixed(2)}). Consider raising max price or adding airlines.`,
      { budgetCap },
      legKey
    );
    return;
  }

  log(
    session,
    "decision",
    `Targeting ${target.offerId} (expected cost $${target.expectedCost}, ${target.seatsRemaining} seats left) — ${
      reason === "urgent-sellout" ? "sellout imminent, booking now" : reason === "confidence-threshold-met" ? "confidence threshold met" : "lowest expected cost among viable fares"
    }.`,
    target,
    legKey
  );

  if (action === "KEEP_MONITORING") {
    log(session, "info", `Building confidence (${legState.pollCount}/${MIN_CONFIDENCE_POLLS} polls) before committing.`, {}, legKey);
    return;
  }

  // action === "BOOK_NOW" — re-check the combined-spend guard one last time
  // right before committing, since the other leg's timer could have booked
  // in between evaluation and this instant.
  const freshCap = session.objective.maxPrice - combinedSpentUSD(session, legKey);
  if (target.priceUSD > freshCap) {
    log(
      session,
      "alert",
      `Blocked booking ${target.offerId}: would push combined spend over the $${session.objective.maxPrice} authorized budget (remaining: $${freshCap.toFixed(2)}).`,
      { target, freshCap },
      legKey
    );
    return;
  }

  clearInterval(legState.timer);
  legState.status = "attempting";
  attemptBooking(session, legKey, target).catch((err) => {
    log(session, "error", `Booking attempt failed: ${err.message}`, {}, legKey);
    legState.status = "monitoring";
    legState.timer = setInterval(
      () => tickLeg(session, legKey).catch((e) => log(session, "error", e.message, {}, legKey)),
      POLL_INTERVAL_MS
    );
  });
}

async function attemptBooking(session, legKey, target) {
  const port = process.env.PORT || 4000;
  const base = `http://localhost:${port}`;
  const url = `${base}/api/booking/attempt/${target.offerId}?sessionId=${session.id}`;
  const isRoundTrip = session.objective.tripType === "round-trip";
  const isCrossCurrency = target.price.currency !== "USD";

  // Pull passenger details from the secure profile store for this booking —
  // the traveller never re-enters them. Only the name is logged; passport
  // number/expiry are decrypted here in memory and never written to any log.
  const passenger = getPassengerForBooking(session.userId);
  if (!passenger) throw new Error("Passenger profile is incomplete — cannot submit booking.");
  log(session, "info", `Using passenger profile on file for ${passenger.fullName}.`, {}, legKey);

  log(session, "x402", `Initiating booking attempt for ${target.offerId} → expecting 402 Payment Required.`, {}, legKey);

  // Round-trip settlement (same-currency legs only) uses a fresh escrow sized
  // to this leg's actual price, created up front so the 402 response can
  // reference it — the session-start escrow remains the untouched combined
  // pre-authorization ceiling. One-way keeps the original behavior exactly:
  // it finishes that same session-start escrow directly.
  if (isRoundTrip && !isCrossCurrency) {
    const legAmountXrp = (target.priceUSD / MOCK_XRP_USD_RATE).toFixed(2);
    log(session, "escrow", `Creating leg-scoped escrow for ${legKey} (${legAmountXrp} XRP, ~$${target.priceUSD})...`, {}, legKey);
    const legEscrow = await withTimeout(
      createEscrow({
        fromWallet: session.wallets.traveller.wallet,
        destinationAddress: session.wallets.airline.address,
        amountXrp: legAmountXrp,
        cancelAfterSeconds: 3600,
      }),
      XRPL_CALL_TIMEOUT_MS,
      `${legKey} createEscrow`
    );
    session.legEscrows[legKey] = legEscrow;
    log(session, "escrow", `${legKey} escrow created.`, { hash: legEscrow.hash, explorerUrl: TESTNET_EXPLORER_TX(legEscrow.hash) }, legKey);
  }

  const firstRes = await withTimeout(fetch(url, { method: "POST" }), XRPL_CALL_TIMEOUT_MS, `${legKey} booking 402 request`);
  if (firstRes.status !== 402) {
    const body = await firstRes.json().catch(() => ({}));
    throw new Error(`Expected 402 from booking endpoint, got ${firstRes.status}: ${JSON.stringify(body)}`);
  }
  const requirements = await firstRes.json();
  log(session, "x402", `Received 402 Payment Required.`, requirements, legKey);

  let settlementHash;

  if (isCrossCurrency) {
    log(
      session,
      "settlement",
      `Cross-currency fare: converting ${target.price.currency} ${target.price.amount} → ${target.priceUSD.toFixed(2)} RLUSD.`,
      {},
      legKey
    );
    const payment = await withTimeout(
      sendIOU({
        fromWallet: session.wallets.traveller.wallet,
        toAddress: session.wallets.airline.address,
        issuerAddress: session.wallets.airline.address,
        amount: target.priceUSD.toFixed(2),
      }),
      XRPL_CALL_TIMEOUT_MS,
      `${legKey} sendIOU`
    );
    settlementHash = payment.hash;
    log(session, "settlement", `RLUSD payment settled on XRPL Testnet in seconds.`, { hash: payment.hash, explorerUrl: TESTNET_EXPLORER_TX(payment.hash) }, legKey);
  } else {
    const escrow = isRoundTrip ? session.legEscrows[legKey] : session.escrow;
    const waitMs = Math.max(0, escrow.finishAfterUnixMs - Date.now());
    if (waitMs > 0) {
      log(session, "info", `Waiting ${Math.ceil(waitMs / 1000)}s for escrow FinishAfter window...`, {}, legKey);
      await new Promise((r) => setTimeout(r, waitMs + 500));
    }

    log(session, "settlement", `Settling payment via EscrowFinish...`, {}, legKey);
    const finish = await withTimeout(
      finishEscrow({
        finisherWallet: session.wallets.agent.wallet,
        ownerAddress: session.wallets.traveller.address,
        offerSequence: escrow.sequence,
      }),
      XRPL_CALL_TIMEOUT_MS,
      `${legKey} finishEscrow`
    );
    settlementHash = finish.hash;
    log(session, "settlement", `Payment settled on XRPL Testnet.`, { hash: finish.hash, explorerUrl: TESTNET_EXPLORER_TX(finish.hash) }, legKey);
  }

  const proof = encodePaymentProof({ txHash: settlementHash });
  log(session, "x402", `Retrying booking request with X-PAYMENT proof.`, {}, legKey);
  const secondRes = await withTimeout(
    fetch(url, { method: "POST", headers: { "X-PAYMENT": proof } }),
    XRPL_CALL_TIMEOUT_MS,
    `${legKey} booking settle request`
  );

  if (secondRes.status !== 200) {
    const body = await secondRes.json().catch(() => ({}));
    throw new Error(`Booking not confirmed after payment: ${secondRes.status} ${JSON.stringify(body)}`);
  }

  const ticket = await secondRes.json();
  const legState = session.legs[legKey];
  legState.ticket = ticket;
  legState.ticketPriceUSD = target.priceUSD;
  legState.status = "booked";
  log(session, "ticket", `Ticket confirmed: ${ticket.confirmationCode} on ${target.offerId}.`, ticket, legKey);
  db.prepare(
    `INSERT INTO bookings (id, user_id, session_id, leg, offer_id, confirmation_code, settlement_tx_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(nanoid(12), session.userId, session.id, legKey, target.offerId, ticket.confirmationCode, ticket.settlementTxHash, new Date().toISOString());
  startPriceWatch(session, legKey, target);

  const otherKey = legKey === "outbound" ? "return" : "outbound";
  const otherLeg = session.legs[otherKey];
  if (!otherLeg || otherLeg.status === "booked") {
    session.status = "booked";
  } else {
    log(session, "info", `${legKey} leg booked — ${otherKey} leg continues monitoring independently.`, {}, otherKey);
  }
}

/**
 * After a leg books, periodically checks whether the mock airline has since
 * dropped that fare's price (via the demo price-drop control) and, if so,
 * automatically settles a small refund of the difference back to the
 * traveller — a real XRPL transaction (Payment, or an RLUSD issuance for
 * cross-currency legs), gated behind an x402-style trigger condition rather
 * than a human noticing and requesting it.
 */
function startPriceWatch(session, legKey, bookedTarget) {
  const legState = session.legs[legKey];
  let ticks = 0;

  legState.priceWatchTimer = setInterval(async () => {
    ticks += 1;
    if (ticks > PRICE_WATCH_MAX_TICKS) {
      clearInterval(legState.priceWatchTimer);
      return;
    }

    const current = inventoryStore.get(bookedTarget.offerId);
    if (!current) return;

    const currentPriceUSD = toUSD(current.price.amount, current.price.currency) * cabinMultiplier(session.objective.cabinClass);
    const drop = legState.ticketPriceUSD - currentPriceUSD;
    if (drop < MIN_REFUNDABLE_DROP_USD) return;

    clearInterval(legState.priceWatchTimer);
    log(
      session,
      "info",
      `Price drop detected on ${bookedTarget.offerId}: was $${legState.ticketPriceUSD.toFixed(2)}, now $${currentPriceUSD.toFixed(2)}. Issuing automatic micro-refund of $${drop.toFixed(2)}...`,
      {},
      legKey
    );

    try {
      let refundHash;
      if (bookedTarget.price.currency !== "USD") {
        const payment = await withTimeout(
          sendIOU({
            fromWallet: session.wallets.airline.wallet,
            toAddress: session.wallets.traveller.address,
            issuerAddress: session.wallets.airline.address,
            amount: drop.toFixed(2),
          }),
          XRPL_CALL_TIMEOUT_MS,
          `${legKey} refund sendIOU`
        );
        refundHash = payment.hash;
      } else {
        const refundXrp = (drop / MOCK_XRP_USD_RATE).toFixed(2);
        const payment = await withTimeout(
          sendXRPPayment({ fromWallet: session.wallets.airline.wallet, toAddress: session.wallets.traveller.address, amountXrp: refundXrp }),
          XRPL_CALL_TIMEOUT_MS,
          `${legKey} refund sendXRPPayment`
        );
        refundHash = payment.hash;
      }
      legState.refund = {
        amountUSD: Math.round(drop * 100) / 100,
        hash: refundHash,
        explorerUrl: TESTNET_EXPLORER_TX(refundHash),
        at: new Date().toISOString(),
      };
      log(session, "refund", `Micro-refund of $${drop.toFixed(2)} settled on XRPL Testnet.`, {
        hash: refundHash,
        explorerUrl: TESTNET_EXPLORER_TX(refundHash),
      }, legKey);
    } catch (err) {
      log(session, "error", `Price-drop refund failed: ${err.message}`, {}, legKey);
    }
  }, PRICE_WATCH_INTERVAL_MS);
}

export function stopSession(session) {
  for (const leg of Object.values(session.legs)) {
    if (leg?.timer) clearInterval(leg.timer);
    if (leg?.priceWatchTimer) clearInterval(leg.priceWatchTimer);
  }
  session.status = "cancelled";
}
