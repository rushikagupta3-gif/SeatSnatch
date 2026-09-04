import { Wallet } from "xrpl";
import { getClient, TESTNET_EXPLORER_ACCOUNT } from "./client.js";

/**
 * Generates a new XRPL testnet wallet and funds it via the public faucet.
 * fundWallet() on a testnet Client hits https://faucet.altnet.rippletest.net internally.
 */
export async function generateAndFundWallet(label = "wallet") {
  const client = await getClient();
  const { wallet, balance } = await client.fundWallet();
  console.log(`[xrpl] funded ${label}: ${wallet.address} — ${balance} XRP`);
  console.log(`[xrpl] explorer: ${TESTNET_EXPLORER_ACCOUNT(wallet.address)}`);
  return {
    label,
    address: wallet.address,
    seed: wallet.seed,
    publicKey: wallet.publicKey,
    privateKey: wallet.privateKey,
    balance,
  };
}

export async function getBalance(address) {
  const client = await getClient();
  try {
    const balance = await client.getXrpBalance(address);
    return balance;
  } catch (err) {
    if (err?.data?.error === "actNotFound") return 0;
    throw err;
  }
}

export function walletFromSeed(seed) {
  return Wallet.fromSeed(seed);
}
