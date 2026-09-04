/**
 * Mocked layover-risk dataset: a small hardcoded set of "historically
 * delay-prone" vs "punctual" airports for demo purposes. A production
 * version would use real on-time performance data (e.g. BTS / FlightStats).
 * riskScore: 0 (very reliable) to 1 (high delay risk), used in the agent's
 * expected-value scoring.
 */
export const AIRPORT_RISK = {
  ORD: { name: "Chicago O'Hare", riskScore: 0.72 },
  EWR: { name: "Newark Liberty", riskScore: 0.68 },
  JFK: { name: "New York JFK", riskScore: 0.55 },
  LHR: { name: "London Heathrow", riskScore: 0.5 },
  ATL: { name: "Atlanta", riskScore: 0.35 },
  DFW: { name: "Dallas/Fort Worth", riskScore: 0.4 },
  DXB: { name: "Dubai", riskScore: 0.15 },
  SIN: { name: "Singapore Changi", riskScore: 0.08 },
  HND: { name: "Tokyo Haneda", riskScore: 0.1 },
  ZRH: { name: "Zurich", riskScore: 0.12 },
  AMS: { name: "Amsterdam Schiphol", riskScore: 0.3 },
  DOH: { name: "Doha Hamad", riskScore: 0.1 },
};

export function getAirportRisk(code) {
  return AIRPORT_RISK[code]?.riskScore ?? 0.4; // default moderate risk for unknown airports
}
