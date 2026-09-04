import { getClient } from "./client.js";

/**
 * RLUSD-style cross-currency settlement on XRPL Testnet.
 *
 * DISCLOSED SIMPLIFICATION: the public RLUSD testnet faucet (tryrlusd.com)
 * is not reachable from this build environment (DNS/network block), and its
 * flow is a manual, captcha-gated web form not safely automatable for a live
 * demo. Instead, our own "airline" wallet acts as the issuer of a
 * testnet-only IOU using the real RLUSD currency code, so the on-chain
 * mechanics (TrustSet, IOU Payment, near-instant finality) are identical to
 * what a genuine RLUSD settlement would look like — only the issuer identity
 * differs. This is surfaced explicitly in the UI, not hidden.
 */

// XRPL non-standard currency codes are a 160-bit (40 hex char) value.
// This encodes the ASCII string "RLUSD" left-justified, zero-padded.
export function toCurrencyCode(ascii) {
  const hex = Buffer.from(ascii, "ascii").toString("hex").toUpperCase();
  return hex.padEnd(40, "0");
}

export const RLUSD_CURRENCY = toCurrencyCode("RLUSD");

export async function setupTrustline({ wallet, issuerAddress, limit = "1000000" }) {
  const client = await getClient();
  const tx = {
    TransactionType: "TrustSet",
    Account: wallet.address,
    LimitAmount: {
      currency: RLUSD_CURRENCY,
      issuer: issuerAddress,
      value: limit,
    },
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  const engineResult = result.result.meta?.TransactionResult;
  if (engineResult !== "tesSUCCESS" && engineResult !== "tecNO_LINE_REDUNDANT") {
    throw new Error(`TrustSet failed: ${engineResult}`);
  }
  return { hash: result.result.hash };
}

export async function sendIOU({ fromWallet, toAddress, issuerAddress, amount }) {
  const client = await getClient();
  const tx = {
    TransactionType: "Payment",
    Account: fromWallet.address,
    Destination: toAddress,
    Amount: {
      currency: RLUSD_CURRENCY,
      issuer: issuerAddress,
      value: String(amount),
    },
  };
  const prepared = await client.autofill(tx);
  const signed = fromWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  const engineResult = result.result.meta?.TransactionResult;
  if (engineResult !== "tesSUCCESS") {
    throw new Error(`RLUSD Payment failed: ${engineResult}`);
  }
  return { hash: result.result.hash, ledgerIndex: result.result.ledger_index };
}

export async function getRLUSDBalance(address, issuerAddress) {
  const client = await getClient();
  try {
    const lines = await client.request({ command: "account_lines", account: address, peer: issuerAddress });
    const line = lines.result.lines.find((l) => l.currency === RLUSD_CURRENCY);
    return line ? Number(line.balance) : 0;
  } catch {
    return 0;
  }
}
