/**
 * Minimal x402 ("HTTP 402 Payment Required") flow between the agent and the
 * mock airline booking endpoint. Modeled after the XRPL x402 facilitator
 * pattern (xrpl-x402.t54.ai): a resource server responds 402 with a
 * PaymentRequirements payload; the client settles payment out-of-band (here,
 * via an XRPL EscrowFinish) and retries the request with an X-PAYMENT proof
 * header. This is a minimal, demo-correct implementation, not spec-complete.
 */

export function buildPaymentRequirements({ offer, escrow, rlusd }) {
  if (offer.price.currency !== "USD" && rlusd) {
    return {
      x402Version: 1,
      accepts: [
        {
          scheme: "xrpl-rlusd",
          network: "xrpl-testnet",
          resource: `/api/booking/attempt/${offer.id}`,
          description: `Cross-currency payment for fare ${offer.id} (${offer.availabilityCode}) ${offer.origin}->${offer.destination}, priced in ${offer.price.currency}`,
          amount: rlusd.amountRLUSD,
          currency: "RLUSD",
          sourceCurrency: offer.price.currency,
          sourceAmount: offer.price.amount,
          payTo: rlusd.issuerAddress,
          fromAddress: rlusd.fromAddress,
        },
      ],
    };
  }

  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "xrpl-escrow",
        network: "xrpl-testnet",
        resource: `/api/booking/attempt/${offer.id}`,
        description: `Payment for fare ${offer.id} (${offer.availabilityCode}) ${offer.origin}->${offer.destination}`,
        amount: offer.price.amount,
        currency: offer.price.currency,
        payTo: escrow.destination,
        escrowOwner: escrow.account,
        escrowOfferSequence: escrow.sequence,
      },
    ],
  };
}

/** Parses the X-PAYMENT proof header the agent sends when retrying after a 402. */
export function parsePaymentProof(header) {
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function encodePaymentProof(proof) {
  return Buffer.from(JSON.stringify(proof), "utf-8").toString("base64");
}
