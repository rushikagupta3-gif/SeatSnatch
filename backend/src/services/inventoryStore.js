import { nanoid } from "nanoid";
import { getAirportRisk } from "../data/airports.js";
import { AIRLINES } from "../data/airlines.js";

/**
 * Mock flight inventory service, shaped like a real GDS/aggregator response
 * (fare-class letter + digit availability codes, e.g. "Y9", "Y3", "Y0" —
 * standard IATA booking-class availability format). This is a deliberate,
 * disclosed simplification: real GDS access (Amadeus/Sabre) isn't available
 * in a hackathon window. Loosely mirrors Duffel's offer schema for realism.
 *
 * Offers carry a `leg` ("outbound" | "return") so a round-trip session can
 * evaluate and deplete each leg independently.
 */

const FARE_CLASS_LETTERS = { economy: "Y", premium: "W", business: "J" };

function makeOffer({ id, leg, origin, destination, date, fareClass, basePrice, currency, seats, layovers, airlineCode, flightNumber }) {
  const airline = AIRLINES.find((a) => a.code === airlineCode) ?? AIRLINES[0];
  return {
    id,
    leg,
    origin,
    destination,
    departDate: date,
    fareClass, // e.g. "economy"
    fareBasisLetter: FARE_CLASS_LETTERS[fareClass] ?? "Y",
    price: { amount: basePrice, currency },
    seatsRemaining: seats,
    layovers: layovers.map((l) => ({ ...l, riskScore: getAirportRisk(l.airport) })),
    totalDurationMinutes: layovers.reduce((sum, l) => sum + l.layoverMinutes, 0) + layovers.length * 180 + 240,
    airline: { code: airline.code, name: airline.name },
    flightNumber: `${airline.code}${flightNumber}`,
  };
}

function availabilityCode(offer) {
  const digit = Math.max(0, Math.min(9, offer.seatsRemaining));
  return `${offer.fareBasisLetter}${digit}`;
}

class InventoryStore {
  constructor() {
    this.offers = new Map();
    this.history = new Map(); // offerId -> [{t, seatsRemaining}]
    this.seedDefault();
  }

  seedDefault() {
    const departDate = "2026-11-14";
    const returnDate = "2026-11-21";
    const seed = [
      // --- outbound leg ---
      makeOffer({
        id: "offer_A",
        leg: "outbound",
        origin: "SFO",
        destination: "LHR",
        date: departDate,
        fareClass: "economy",
        basePrice: 542,
        currency: "USD",
        seats: 3,
        layovers: [{ airport: "EWR", layoverMinutes: 95 }],
        airlineCode: "UA",
        flightNumber: 918,
      }),
      makeOffer({
        id: "offer_B",
        leg: "outbound",
        origin: "SFO",
        destination: "LHR",
        date: departDate,
        fareClass: "economy",
        basePrice: 578,
        currency: "USD",
        seats: 5,
        layovers: [],
        airlineCode: "BA",
        flightNumber: 286,
      }),
      makeOffer({
        id: "offer_C",
        leg: "outbound",
        origin: "SFO",
        destination: "LHR",
        date: departDate,
        fareClass: "economy",
        basePrice: 511,
        currency: "USD",
        seats: 2,
        layovers: [{ airport: "ORD", layoverMinutes: 140 }],
        airlineCode: "AA",
        flightNumber: 1452,
      }),
      // Foreign-currency fare: settlement for this one routes through RLUSD
      // instead of the XRP escrow, demonstrating cross-currency settlement.
      makeOffer({
        id: "offer_D",
        leg: "outbound",
        origin: "SFO",
        destination: "LHR",
        date: departDate,
        fareClass: "economy",
        basePrice: 395,
        currency: "GBP",
        seats: 4,
        layovers: [{ airport: "AMS", layoverMinutes: 80 }],
        airlineCode: "VS",
        flightNumber: 42,
      }),

      // --- return leg (independent inventory, own depletion timeline) ---
      makeOffer({
        id: "offer_R1",
        leg: "return",
        origin: "LHR",
        destination: "SFO",
        date: returnDate,
        fareClass: "economy",
        basePrice: 561,
        currency: "USD",
        seats: 3,
        layovers: [{ airport: "EWR", layoverMinutes: 110 }],
        airlineCode: "UA",
        flightNumber: 919,
      }),
      makeOffer({
        id: "offer_R2",
        leg: "return",
        origin: "LHR",
        destination: "SFO",
        date: returnDate,
        fareClass: "economy",
        basePrice: 599,
        currency: "USD",
        seats: 4,
        layovers: [],
        airlineCode: "BA",
        flightNumber: 285,
      }),
      makeOffer({
        id: "offer_R3",
        leg: "return",
        origin: "LHR",
        destination: "SFO",
        date: returnDate,
        fareClass: "economy",
        basePrice: 527,
        currency: "USD",
        seats: 2,
        layovers: [{ airport: "DFW", layoverMinutes: 105 }],
        airlineCode: "DL",
        flightNumber: 63,
      }),
    ];
    for (const offer of seed) {
      this.offers.set(offer.id, offer);
      this.history.set(offer.id, [{ t: Date.now(), seatsRemaining: offer.seatsRemaining }]);
    }
  }

  /** @param {"outbound"|"return"} [leg] - filter to one leg; omit for all offers */
  list(leg) {
    return Array.from(this.offers.values())
      .filter((o) => !leg || o.leg === leg)
      .map((o) => ({ ...o, availabilityCode: availabilityCode(o) }));
  }

  get(offerId) {
    const offer = this.offers.get(offerId);
    if (!offer) return null;
    return { ...offer, availabilityCode: availabilityCode(offer) };
  }

  getHistory(offerId) {
    return this.history.get(offerId) ?? [];
  }

  /** Decrement seats on an offer (used by demo control + successful bookings). */
  decrementSeats(offerId, by = 1) {
    const offer = this.offers.get(offerId);
    if (!offer) return null;
    offer.seatsRemaining = Math.max(0, offer.seatsRemaining - by);
    const h = this.history.get(offerId);
    h.push({ t: Date.now(), seatsRemaining: offer.seatsRemaining });
    if (h.length > 200) h.shift();
    return this.get(offerId);
  }

  /** Force an offer's seat count to an exact value (used by the agent-vs-agent demo to set up a single-seat race). */
  setSeats(offerId, seats) {
    const offer = this.offers.get(offerId);
    if (!offer) return null;
    offer.seatsRemaining = Math.max(0, seats);
    const h = this.history.get(offerId);
    h.push({ t: Date.now(), seatsRemaining: offer.seatsRemaining });
    if (h.length > 200) h.shift();
    return this.get(offerId);
  }

  /** Change an offer's fare price (used by the price-drop micro-refund demo control). */
  setPrice(offerId, amount) {
    const offer = this.offers.get(offerId);
    if (!offer) return null;
    offer.price = { ...offer.price, amount };
    return this.get(offerId);
  }

  /** Book (finalize sale of) 1 seat, generating a PNR-like confirmation code. */
  bookSeat(offerId) {
    const offer = this.offers.get(offerId);
    if (!offer) throw new Error("offer not found");
    if (offer.seatsRemaining <= 0) throw new Error("sold out");
    this.decrementSeats(offerId, 1);
    return {
      confirmationCode: nanoid(6).toUpperCase(),
      offerId,
      bookedAt: new Date().toISOString(),
    };
  }

  reset() {
    this.offers.clear();
    this.history.clear();
    this.seedDefault();
  }
}

export const inventoryStore = new InventoryStore();
