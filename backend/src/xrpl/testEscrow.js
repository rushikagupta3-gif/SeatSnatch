// (superseded by the full end-to-end session flow — kept for isolated escrow sanity checks)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { walletFromSeed, getBalance } from "./wallets.js";
import { createEscrow, finishEscrow } from "./escrow.js";
import { disconnectClient, TESTNET_EXPLORER_TX } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WALLETS_PATH = path.join(__dirname, "../data/wallets.json");

async function main() {
  if (!fs.existsSync(WALLETS_PATH)) {
    console.error("No wallets.json found — run `npm run fund-wallets` first.");
    process.exit(1);
  }
  const { traveller, agent } = JSON.parse(fs.readFileSync(WALLETS_PATH, "utf-8"));
  const travellerWallet = walletFromSeed(traveller.seed);
  const agentWallet = walletFromSeed(agent.seed);

  console.log(`Traveller: ${traveller.address}`);
  console.log(`Agent:     ${agent.address}\n`);

  console.log("--- EscrowCreate: traveller locks 5 XRP for the agent ---");
  const escrow = await createEscrow({
    fromWallet: travellerWallet,
    destinationAddress: agent.address,
    amountXrp: "5",
    cancelAfterSeconds: 3600,
  });
  console.log(`EscrowCreate tx: ${escrow.hash}`);
  console.log(`Explorer: ${TESTNET_EXPLORER_TX(escrow.hash)}`);
  console.log(`OfferSequence: ${escrow.sequence}\n`);

  const waitMs = Math.max(0, escrow.finishAfterUnixMs - Date.now()) + 2000;
  console.log(`Waiting ${Math.ceil(waitMs / 1000)}s for FinishAfter to pass...\n`);
  await new Promise((r) => setTimeout(r, waitMs));

  console.log("--- EscrowFinish: agent releases the locked funds to itself ---");
  const finish = await finishEscrow({
    finisherWallet: agentWallet,
    ownerAddress: traveller.address,
    offerSequence: escrow.sequence,
  });
  console.log(`EscrowFinish tx: ${finish.hash}`);
  console.log(`Explorer: ${TESTNET_EXPLORER_TX(finish.hash)}\n`);

  const travellerBalance = await getBalance(traveller.address);
  const agentBalance = await getBalance(agent.address);
  console.log(`Traveller balance now: ${travellerBalance} XRP`);
  console.log(`Agent balance now:     ${agentBalance} XRP`);

  console.log("\nEscrow lock/release cycle confirmed working on Testnet.");
  await disconnectClient();
  process.exit(0);
}

main().catch((err) => {
  console.error("Escrow test failed:", err);
  process.exit(1);
});
