import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateAndFundWallet } from "./wallets.js";
import { disconnectClient } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "../data/wallets.json");

/**
 * Pre-funds all wallets the demo needs and caches them to disk so the live
 * demo never depends on a live faucet call (rate limits / latency on stage).
 * Run manually before the demo: `npm run fund-wallets`
 */
async function main() {
  console.log("Funding demo wallets on XRPL Testnet — this may take ~10-20s per wallet...\n");

  const traveller = await generateAndFundWallet("traveller");
  const agent = await generateAndFundWallet("agent");
  const airline = await generateAndFundWallet("airline (mock booking endpoint)");

  const wallets = { traveller, agent, airline, fundedAt: new Date().toISOString() };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(wallets, null, 2));

  console.log(`\nSaved wallet credentials to ${OUT_PATH}`);
  console.log("These are TESTNET-ONLY credentials with no real value. Safe for local demo use.");

  await disconnectClient();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to fund wallets:", err);
  process.exit(1);
});
