import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { walletFromSeed } from "../xrpl/wallets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WALLETS_PATH = path.join(__dirname, "../data/wallets.json");

/** Loads the pre-funded demo wallets cached by `npm run fund-wallets`. */
export function loadDemoWallets() {
  if (!fs.existsSync(WALLETS_PATH)) {
    throw new Error(
      "No pre-funded wallets found. Run `npm run fund-wallets` in /backend before starting the server."
    );
  }
  const raw = JSON.parse(fs.readFileSync(WALLETS_PATH, "utf-8"));
  return {
    traveller: { ...raw.traveller, wallet: walletFromSeed(raw.traveller.seed) },
    agent: { ...raw.agent, wallet: walletFromSeed(raw.agent.seed) },
    airline: { ...raw.airline, wallet: walletFromSeed(raw.airline.seed) },
    fundedAt: raw.fundedAt,
  };
}
