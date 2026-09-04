import { isoTimeToRippleTime, rippleTimeToISOTime, xrpToDrops } from "xrpl";
import { getClient } from "./client.js";

/**
 * Native XRPL Escrow primitives (EscrowCreate / EscrowFinish / EscrowCancel).
 * Used to hold a pre-authorized spending budget for the agent: the traveller
 * locks funds up front, and the agent releases (finishes) portions of it as
 * it settles bookings — no human approval per transaction.
 */

// Ripple epoch starts 2000-01-01. CancelAfter must be > FinishAfter and in the future.
export function secondsFromNowRippleTime(seconds) {
  return isoTimeToRippleTime(new Date(Date.now() + seconds * 1000).toISOString());
}

/**
 * Create an escrow from `fromWallet` locking `amountXrp` XRP. FinishAfter
 * must be strictly after the ledger's current close time or rippled rejects
 * the tx with tecNO_PERMISSION (ledger close time lags wall clock by a
 * couple seconds on Testnet) — so it's set a few seconds in the future, not
 * the past. Callers must wait past FINISH_AFTER_BUFFER_SECONDS before
 * calling finishEscrow. CancelAfter bounds how long the lock can sit unused
 * (default 1 hour — the whole demo).
 */
export const FINISH_AFTER_BUFFER_SECONDS = 5;

export async function createEscrow({ fromWallet, destinationAddress, amountXrp, cancelAfterSeconds = 3600 }) {
  const client = await getClient();

  const tx = {
    TransactionType: "EscrowCreate",
    Account: fromWallet.address,
    Destination: destinationAddress,
    Amount: xrpToDrops(amountXrp),
    FinishAfter: secondsFromNowRippleTime(FINISH_AFTER_BUFFER_SECONDS),
    CancelAfter: secondsFromNowRippleTime(cancelAfterSeconds),
  };

  const prepared = await client.autofill(tx);
  const signed = fromWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  const meta = result.result.meta;
  const engineResult = typeof meta === "object" ? meta.TransactionResult : result.result.engine_result;
  if (engineResult !== "tesSUCCESS") {
    throw new Error(`EscrowCreate failed: ${engineResult}`);
  }

  return {
    hash: result.result.hash,
    sequence: prepared.Sequence,
    account: fromWallet.address,
    destination: destinationAddress,
    amountXrp,
    ledgerIndex: result.result.ledger_index,
    finishAfterUnixMs: Date.now() + FINISH_AFTER_BUFFER_SECONDS * 1000,
  };
}

/**
 * Release (finish) an escrow, paying the locked amount to Destination.
 * Called by the agent the moment it decides to settle a booking payment.
 */
export async function finishEscrow({ finisherWallet, ownerAddress, offerSequence }) {
  const client = await getClient();

  const tx = {
    TransactionType: "EscrowFinish",
    Account: finisherWallet.address,
    Owner: ownerAddress,
    OfferSequence: offerSequence,
  };

  const prepared = await client.autofill(tx);
  const signed = finisherWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  const meta = result.result.meta;
  const engineResult = typeof meta === "object" ? meta.TransactionResult : result.result.engine_result;
  if (engineResult !== "tesSUCCESS") {
    throw new Error(`EscrowFinish failed: ${engineResult}`);
  }

  return {
    hash: result.result.hash,
    ledgerIndex: result.result.ledger_index,
  };
}

/** Cancel an escrow past its CancelAfter time, returning funds to the owner. */
export async function cancelEscrow({ cancellerWallet, ownerAddress, offerSequence }) {
  const client = await getClient();

  const tx = {
    TransactionType: "EscrowCancel",
    Account: cancellerWallet.address,
    Owner: ownerAddress,
    OfferSequence: offerSequence,
  };

  const prepared = await client.autofill(tx);
  const signed = cancellerWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  const meta = result.result.meta;
  const engineResult = typeof meta === "object" ? meta.TransactionResult : result.result.engine_result;
  if (engineResult !== "tesSUCCESS") {
    throw new Error(`EscrowCancel failed: ${engineResult}`);
  }

  return {
    hash: result.result.hash,
    ledgerIndex: result.result.ledger_index,
  };
}
