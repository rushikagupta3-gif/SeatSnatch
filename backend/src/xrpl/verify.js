import { getClient } from "./client.js";

/**
 * Verifies a settlement transaction on XRPL Testnet actually happened as
 * claimed, before the mock airline endpoint releases the ticket. Used by
 * the x402 flow to validate the X-PAYMENT proof (an EscrowFinish tx hash).
 */
export async function verifyEscrowFinish({ txHash, expectedOwner, expectedOfferSequence }) {
  const client = await getClient();
  const { result: tx } = await client.request({
    command: "tx",
    transaction: txHash,
  });

  if (tx.TransactionType !== "EscrowFinish") {
    return { ok: false, reason: "not an EscrowFinish transaction" };
  }
  if (tx.Owner !== expectedOwner) {
    return { ok: false, reason: "escrow owner mismatch" };
  }
  if (tx.OfferSequence !== expectedOfferSequence) {
    return { ok: false, reason: "offer sequence mismatch" };
  }
  const validated = tx.validated ?? tx.meta?.TransactionResult === "tesSUCCESS";
  if (!validated) {
    return { ok: false, reason: "transaction not validated" };
  }

  return { ok: true, tx };
}

/** Verifies an XRPL IOU Payment transaction (used for RLUSD settlement). */
export async function verifyRLUSDPayment({ txHash, expectedDestination, expectedCurrency, expectedIssuer, minAmount }) {
  const client = await getClient();
  const { result: tx } = await client.request({
    command: "tx",
    transaction: txHash,
  });

  if (tx.TransactionType !== "Payment") {
    return { ok: false, reason: "not a Payment transaction" };
  }
  if (tx.Destination !== expectedDestination) {
    return { ok: false, reason: "destination mismatch" };
  }
  const amount = tx.Amount ?? tx.tx_json?.Amount;
  if (typeof amount !== "object" || amount.currency !== expectedCurrency || amount.issuer !== expectedIssuer) {
    return { ok: false, reason: "currency/issuer mismatch" };
  }
  if (Number(amount.value) < Number(minAmount) - 0.01) {
    return { ok: false, reason: "amount below required minimum" };
  }
  const meta = tx.meta;
  if (meta?.TransactionResult !== "tesSUCCESS") {
    return { ok: false, reason: "transaction not successful" };
  }

  return { ok: true, tx };
}
