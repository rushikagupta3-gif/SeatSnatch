import { getAirportRisk } from "../data/airports.js";

/**
 * Real flight search via the Duffel API (https://duffel.com), in TEST MODE.
 * This is a real HTTP API with a real key — not a fabricated response — but
 * Duffel's test mode returns realistic *synthetic* airline offers (mixed in
 * with a placeholder "Duffel Airways" carrier), not live bookable inventory.
 * That's disclosed here and in the README: it's the standard, sanctioned way
 * to develop against Duffel without touching real airline systems or money.
 *
 * Duffel does not expose exact seats-remaining (no GDS does, competitively),
 * so seatsRemaining below is synthesized for the live depletion demo — also
 * disclosed, not hidden.
 */

const DUFFEL_BASE = "https://api.duffel.com";
const MAX_OFFERS_PER_LEG = 6;

function currencyToFareLetter(amountUSD) {
  if (amountUSD < 400) return "Y";
  if (amountUSD < 700) return "W";
  return "J";
}

function extractLayovers(segments) {
  const layovers = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const arriveAt = new Date(segments[i].arriving_at);
    const departAt = new Date(segments[i + 1].departing_at);
    const airport = segments[i].destination?.iata_code || segments[i].destination_terminal || "???";
    const layoverMinutes = Math.max(0, Math.round((departAt - arriveAt) / 60000));
    layovers.push({ airport, layoverMinutes, riskScore: getAirportRisk(airport) });
  }
  return layovers;
}

function normalizeOffer(offer, leg, idx) {
  const slice = offer.slices[0];
  const firstSeg = slice.segments[0];
  const amount = Number(offer.total_amount);
  const layovers = extractLayovers(slice.segments);
  const totalDurationMinutes =
    layovers.reduce((sum, l) => sum + l.layoverMinutes, 0) +
    Math.round((new Date(slice.segments[slice.segments.length - 1].arriving_at) - new Date(firstSeg.departing_at)) / 60000);

  return {
    id: `duffel_${leg}_${idx}_${offer.id.slice(-8)}`,
    leg,
    origin: firstSeg.origin?.iata_code,
    destination: slice.segments[slice.segments.length - 1].destination?.iata_code,
    departDate: firstSeg.departing_at?.slice(0, 10),
    fareClass: "economy",
    fareBasisLetter: currencyToFareLetter(amount),
    price: { amount: Math.round(amount * 100) / 100, currency: offer.total_currency },
    // Duffel doesn't expose real seat counts — synthesized for the live
    // depletion demo, seeded from the offer's own id so it's stable per run.
    seatsRemaining: 2 + (offer.id.charCodeAt(offer.id.length - 1) % 4),
    layovers,
    totalDurationMinutes,
    airline: { code: firstSeg.marketing_carrier?.iata_code, name: firstSeg.marketing_carrier?.name },
    flightNumber: `${firstSeg.marketing_carrier?.iata_code}${firstSeg.marketing_carrier_flight_number}`,
    source: "duffel",
    duffelOfferId: offer.id,
  };
}

/**
 * Searches real (test-mode) flights for one leg. Returns normalized offers
 * shaped exactly like the mock inventory's offers, so the rest of the app
 * (scoring, depletion, booking) doesn't need to know the difference.
 * Throws on failure — callers should catch and fall back to mock data so a
 * Duffel hiccup never blocks the live demo.
 */
export async function searchDuffelFlights({ origin, destination, departDate, leg }) {
  const apiKey = process.env.DUFFEL_API_KEY;
  if (!apiKey) throw new Error("DUFFEL_API_KEY is not set");

  const res = await fetch(`${DUFFEL_BASE}/air/offer_requests?return_offers=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Duffel-Version": "v2",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        slices: [{ origin, destination, departure_date: departDate }],
        passengers: [{ type: "adult" }],
        cabin_class: "economy",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Duffel search failed (${res.status}): ${body.errors?.[0]?.message || res.statusText}`);
  }

  const body = await res.json();
  const offers = body.data?.offers || [];
  if (offers.length === 0) throw new Error("Duffel returned no offers for this route/date");

  // Pick a diverse, manageable set: cheapest first, one offer per airline
  // where possible, capped at MAX_OFFERS_PER_LEG.
  const sorted = [...offers].sort((a, b) => Number(a.total_amount) - Number(b.total_amount));
  const seenAirlines = new Set();
  const picked = [];
  for (const o of sorted) {
    const airlineCode = o.slices[0].segments[0].marketing_carrier?.iata_code;
    if (seenAirlines.has(airlineCode) && picked.length < sorted.length) continue;
    seenAirlines.add(airlineCode);
    picked.push(o);
    if (picked.length >= MAX_OFFERS_PER_LEG) break;
  }
  const finalPicks = picked.length >= 3 ? picked : sorted.slice(0, MAX_OFFERS_PER_LEG);

  return finalPicks.map((o, i) => normalizeOffer(o, leg, i));
}
