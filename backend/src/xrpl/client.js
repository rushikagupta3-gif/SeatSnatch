import { Client } from "xrpl";

export const TESTNET_WSS = "wss://s.altnet.rippletest.net:51233";
export const TESTNET_EXPLORER_TX = (hash) => `https://testnet.xrpl.org/transactions/${hash}`;
export const TESTNET_EXPLORER_ACCOUNT = (addr) => `https://testnet.xrpl.org/accounts/${addr}`;

let sharedClient = null;

export async function getClient() {
  if (sharedClient && sharedClient.isConnected()) return sharedClient;
  sharedClient = new Client(TESTNET_WSS);
  await sharedClient.connect();
  return sharedClient;
}

export async function disconnectClient() {
  if (sharedClient && sharedClient.isConnected()) {
    await sharedClient.disconnect();
  }
}
