import { cabinMultiplier } from "../data/airlines.js";

/**
 * Deterministic rules/heuristics scoring — no LLM call, so the demo has zero
 * external-dependency latency risk. This IS the agent's "reasoning": every
 * number here is computed live and shown in the UI reasoning panel.
 */

/** Depletion-rate projection from a seats-over-time history sample. */
export function computeDepletion(history) {
  if (!history || history.length < 2) {
    return { ratePerSec: 0, projectedSelloutSeconds: null, confidence: "insufficient-data" };
  }
  // Use a recent window (last 6 samples) so the rate reacts to recent demo actions.
  const window = history.slice(-6);
  const first = window[0];
  const last = window[window.length - 1];
  const dtSec = (last.t - first.t) / 1000;
  const seatsLost = first.seatsRemaining - last.seatsRemaining;

  if (dtSec <= 0 || seatsLost <= 0) {
    return { ratePerSec: 0, projectedSelloutSeconds: null, confidence: window.length >= 4 ? "stable" : "insufficient-data" };
  }

  const ratePerSec = seatsLost / dtSec;
  const projectedSelloutSeconds = last.seatsRemaining > 0 ? last.seatsRemaining / ratePerSec : 0;

  return {
    ratePerSec,
    projectedSelloutSeconds,
    confidence: window.length >= 4 ? "high" : "medium",
  };
}

// Mock FX rates to USD, for comparing fares priced in different currencies.
// Disclosed as illustrative, not a live market feed.
const FX_TO_USD = { USD: 1, GBP: 1.27, EUR: 1.09 };

export function toUSD(amount, currency) {
  return amount * (FX_TO_USD[currency] ?? 1);
}

/**
 * Expected-cost score combining price + layover time cost + layover risk
 * cost into one number (lower is better), normalized to USD so fares in
 * different currencies are comparable, and scaled by the selected cabin
 * class. hourlyLayoverCost and riskDollarValue come from the user's stated
 * preferences.
 */
export function computeExpectedCost(offer, { hourlyLayoverCost, riskDollarValue, cabinClass = "economy" }) {
  const basePriceUSD = toUSD(offer.price.amount, offer.price.currency);
  const priceUSD = basePriceUSD * cabinMultiplier(cabinClass);
  const layoverMinutes = offer.layovers.reduce((sum, l) => sum + l.layoverMinutes, 0);
  const layoverTimeCost = (layoverMinutes / 60) * hourlyLayoverCost;
  const riskScoreSum = offer.layovers.reduce((sum, l) => sum + l.riskScore, 0);
  const riskCost = riskScoreSum * riskDollarValue;

  const expectedCost = priceUSD + layoverTimeCost + riskCost;

  return {
    expectedCost: Math.round(expectedCost * 100) / 100,
    priceUSD: Math.round(priceUSD * 100) / 100,
    breakdown: {
      basePrice: offer.price.amount,
      basePriceUSD: Math.round(basePriceUSD * 100) / 100,
      cabinClass,
      layoverMinutes,
      layoverTimeCost: Math.round(layoverTimeCost * 100) / 100,
      riskScoreSum: Math.round(riskScoreSum * 100) / 100,
      riskCost: Math.round(riskCost * 100) / 100,
    },
  };
}

/**
 * Full evaluation of one offer: expected cost, depletion projection, and
 * whether it's within the caller's budget cap (this is per-leg remaining
 * budget for round-trip, or the whole trip's max price for one-way — the
 * caller decides which cap applies). preferences.preferredAirlines, if
 * non-empty, restricts viability to offers flown by one of those carriers.
 */
export function evaluateOffer(offer, history, preferences, budgetCap) {
  const { expectedCost, priceUSD, breakdown } = computeExpectedCost(offer, preferences);
  const depletion = computeDepletion(history);
  const withinBudget = priceUSD <= budgetCap;
  const available = offer.seatsRemaining > 0;
  const airlineAllowed =
    !preferences.preferredAirlines?.length || preferences.preferredAirlines.includes(offer.airline.code);

  return {
    offerId: offer.id,
    leg: offer.leg,
    availabilityCode: offer.availabilityCode,
    seatsRemaining: offer.seatsRemaining,
    price: offer.price,
    priceUSD,
    airline: offer.airline,
    flightNumber: offer.flightNumber,
    expectedCost,
    breakdown,
    depletion,
    withinBudget,
    available,
    airlineAllowed,
    viable: withinBudget && available && airlineAllowed,
  };
}

/** Picks the target offer: lowest expected cost among viable offers. */
export function pickTarget(evaluations) {
  const viable = evaluations.filter((e) => e.viable);
  if (viable.length === 0) return null;
  return viable.reduce((best, e) => (e.expectedCost < best.expectedCost ? e : best));
}

const URGENT_SELLOUT_SECONDS = 20;

/**
 * Decides what the agent should do about one leg right now:
 * - BOOK_NOW: a viable target exists and either confidence has built up
 *   (enough polls to trust the depletion read) or the target is about to
 *   sell out, so waiting longer risks losing it.
 * - KEEP_MONITORING: a viable target exists but it's early — keep watching
 *   before committing spend.
 * - ALERT_USER: nothing currently fits the budget/airline/seat constraints;
 *   the user may need to loosen a constraint.
 */
export function decideAction(evaluations, { pollCount, minConfidencePolls }) {
  const target = pickTarget(evaluations);

  if (!target) {
    const anyOffersExist = evaluations.length > 0;
    return { action: "ALERT_USER", target: null, reason: anyOffersExist ? "no-offer-fits-constraints" : "no-inventory" };
  }

  const urgent = target.depletion.projectedSelloutSeconds != null && target.depletion.projectedSelloutSeconds <= URGENT_SELLOUT_SECONDS;
  const confident = pollCount >= minConfidencePolls;

  if (urgent || confident) {
    return { action: "BOOK_NOW", target, reason: urgent ? "urgent-sellout" : "confidence-threshold-met" };
  }

  return { action: "KEEP_MONITORING", target, reason: "building-confidence" };
}
