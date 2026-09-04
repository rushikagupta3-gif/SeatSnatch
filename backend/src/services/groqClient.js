/**
 * Real LLM call (Groq, free tier — https://console.groq.com), used as the
 * agent's own natural-language reasoning pass over the deterministic
 * scoring engine's output. It explains and sanity-checks the choice in
 * plain English — but the deterministic engine in scoring.js remains the
 * one that actually decides what gets purchased, because letting an LLM
 * directly gate a real money-movement action (even on testnet) is a
 * reliability risk on a live demo (latency, occasional bad output). This
 * way, the LLM's involvement is real and visible, without becoming the
 * single point of failure for the booking itself.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b";

export async function explainFlightChoice({ objective, evaluations, target }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const candidates = evaluations
    .filter((e) => e.available)
    .map(
      (e) =>
        `- ${e.offerId}: ${e.airline?.name} ${e.flightNumber}, ${e.price.currency} ${e.price.amount}, ${e.breakdown.layoverMinutes}min layover, expected cost $${e.expectedCost}${e.offerId === target.offerId ? " <- CHOSEN" : ""}`
    )
    .join("\n");

  const prompt = `You are a flight-booking agent's reasoning module. A traveller wants to fly ${objective.origin} to ${objective.destination}, max budget $${objective.maxPrice}, willing to pay $${objective.hourlyLayoverCost}/hr to shorten layovers and $${objective.riskDollarValue} per risk unit for safer connections.

Here are the current candidate flights:
${candidates}

The deterministic scoring engine chose ${target.offerId} (expected cost $${target.expectedCost}). In 2-3 short sentences, explain in plain English why this is a reasonable choice given the traveller's stated preferences, or flag if something looks off. Be concise and specific to the numbers above.`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Groq request failed (${res.status}): ${body.error?.message || res.statusText}`);
  }

  const body = await res.json();
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned an empty response");
  return text;
}
