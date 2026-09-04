import { loadDemoWallets } from "../services/walletRegistry.js";
import { setupTrustline, sendIOU, getRLUSDBalance, RLUSD_CURRENCY } from "./rlusd.js";
import { disconnectClient } from "./client.js";

/**
 * One-time setup for the RLUSD cross-currency demo: the airline wallet acts
 * as issuer, traveller and agent wallets open trustlines to it, and the
 * issuer sends the traveller a starting RLUSD balance. Run before the demo:
 * `npm run fund-rlusd` (after `npm run fund-wallets`).
 */
async function main() {
  const { traveller, agent, airline } = loadDemoWallets();

  console.log(`Issuer (airline): ${airline.address}`);
  console.log(`Currency code: ${RLUSD_CURRENCY} (hex-encoded "RLUSD")\n`);

  console.log("--- TrustSet: traveller -> airline issuer ---");
  await setupTrustline({ wallet: traveller.wallet, issuerAddress: airline.address });
  console.log("Trustline opened.\n");

  console.log("--- TrustSet: agent -> airline issuer ---");
  await setupTrustline({ wallet: agent.wallet, issuerAddress: airline.address });
  console.log("Trustline opened.\n");

  console.log("--- Issuing 2000 RLUSD to traveller ---");
  const issue = await sendIOU({
    fromWallet: airline.wallet,
    toAddress: traveller.address,
    issuerAddress: airline.address,
    amount: "2000",
  });
  console.log(`Issued. tx: ${issue.hash}\n`);

  const balance = await getRLUSDBalance(traveller.address, airline.address);
  console.log(`Traveller RLUSD balance: ${balance}`);

  await disconnectClient();
  process.exit(0);
}

main().catch((err) => {
  console.error("RLUSD setup failed:", err);
  process.exit(1);
});
