import { Router } from "express";
import { inventoryStore } from "../services/inventoryStore.js";
import { getSession, combinedSpentUSD } from "../services/session.js";
import { buildPaymentRequirements, parsePaymentProof } from "../services/x402.js";
import { verifyEscrowFinish, verifyRLUSDPayment } from "../xrpl/verify.js";
import { toUSD } from "../services/scoring.js";
import { RLUSD_CURRENCY } from "../xrpl/rlusd.js";
import { cabinMultiplier } from "../data/airlines.js";

export const bookingRouter = Router();

/**
 * x402-gated mock airline booking endpoint.
 * No X-PAYMENT header -> 402 Payment Required with payment requirements.
 * Valid X-PAYMENT header (an XRPL EscrowFinish or RLUSD Payment tx hash
 * proof) -> books the seat and returns a confirmed ticket.
 *
 * For a round-trip session, the escrow that secures THIS leg's payment is a
 * fresh, leg-scoped escrow created by the agent right before the attempt
 * (session.legEscrows[offer.leg]) rather than the session-start ceiling
 * escrow — see services/session.js for why.
 */
bookingRouter.post("/attempt/:offerId", async (req, res) => {
  const { offerId } = req.params;
  const { sessionId } = req.query;

  const session = getSession(sessionId);
  if (!session || !session.escrow) {
    return res.status(400).json({ error: "unknown or uninitialized session" });
  }

  const offer = inventoryStore.get(offerId);
  if (!offer) return res.status(404).json({ error: "offer not found" });

  const isRoundTrip = session.objective.tripType === "round-trip";
  const isCrossCurrency = offer.price.currency !== "USD";
  const escrowForLeg = isRoundTrip ? session.legEscrows[offer.leg] : session.escrow;

  // Server-side combined-spend guard (defense in depth — the agent's own
  // decision loop already checks this before attempting, but the actual
  // money-movement boundary must not trust the client-side check alone).
  const priceUSD = toUSD(offer.price.amount, offer.price.currency) * cabinMultiplier(session.objective.cabinClass);
  const remainingBudget = session.objective.maxPrice - combinedSpentUSD(session, offer.leg);
  if (priceUSD > remainingBudget + 0.01) {
    return res.status(402).json({
      error: "combined-spend guard: booking this leg would exceed the authorized budget",
      priceUSD,
      remainingBudget,
    });
  }

  const paymentHeader = req.header("X-PAYMENT");

  if (!paymentHeader) {
    let rlusdReq;
    if (isCrossCurrency) {
      const amountRLUSD = priceUSD.toFixed(2); // RLUSD pegged 1:1 to USD
      rlusdReq = { amountRLUSD, issuerAddress: session.wallets.airline.address, fromAddress: session.wallets.traveller.address };
    }
    if (!isCrossCurrency && !escrowForLeg) {
      return res.status(400).json({ error: "no escrow available for this leg yet" });
    }
    const requirements = buildPaymentRequirements({ offer, escrow: escrowForLeg, rlusd: rlusdReq });
    return res.status(402).json(requirements);
  }

  const proof = parsePaymentProof(paymentHeader);
  if (!proof?.txHash) {
    return res.status(400).json({ error: "malformed X-PAYMENT proof" });
  }

  try {
    const verification = isCrossCurrency
      ? await verifyRLUSDPayment({
          txHash: proof.txHash,
          expectedDestination: session.wallets.airline.address,
          expectedCurrency: RLUSD_CURRENCY,
          expectedIssuer: session.wallets.airline.address,
          minAmount: priceUSD,
        })
      : await verifyEscrowFinish({
          txHash: proof.txHash,
          expectedOwner: escrowForLeg.account,
          expectedOfferSequence: escrowForLeg.sequence,
        });

    if (!verification.ok) {
      return res.status(402).json({ error: "payment verification failed", reason: verification.reason });
    }

    if (offer.seatsRemaining <= 0) {
      return res.status(409).json({ error: "sold out before payment settled" });
    }

    const booking = inventoryStore.bookSeat(offerId);
    return res.status(200).json({
      ...booking,
      settledAmountUSD: Math.round(priceUSD * 100) / 100,
      offer: {
        origin: offer.origin,
        destination: offer.destination,
        departDate: offer.departDate,
        price: offer.price,
        airline: offer.airline,
        flightNumber: offer.flightNumber,
        leg: offer.leg,
      },
      settlementTxHash: proof.txHash,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
