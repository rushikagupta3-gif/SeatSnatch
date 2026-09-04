import { xrpToDrops } from "xrpl";
import { getClient } from "./client.js";

/**
 * A plain XRP Payment transaction — used for the post-booking price-drop
 * micro-refund (airline -> traveller), where no escrow/hold semantics are
 * needed, just a direct settlement of the price difference.
 */
export async function sendXRPPayment({ fromWallet, toAddress, amountXrp }) {
  const client = await getClient();
  const tx = {
    TransactionType: "Payment",
    Account: fromWallet.address,
    Destination: toAddress,
    Amount: xrpToDrops(amountXrp),
  };
  const prepared = await client.autofill(tx);
  const signed = fromWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  const engineResult = result.result.meta?.TransactionResult;
  if (engineResult !== "tesSUCCESS") {
    throw new Error(`XRP Payment failed: ${engineResult}`);
  }
  return { hash: result.result.hash, ledgerIndex: result.result.ledger_index };
}
