// Mock carriers used to give each offer a real-looking flight number and let
// the user filter/select which airlines the agent is allowed to consider.
export const AIRLINES = [
  { code: "BA", name: "British Airways" },
  { code: "UA", name: "United Airlines" },
  { code: "VS", name: "Virgin Atlantic" },
  { code: "AA", name: "American Airlines" },
  { code: "DL", name: "Delta Air Lines" },
  { code: "AF", name: "Air France" },
];

export const CABIN_CLASSES = [
  { id: "economy", label: "Economy", multiplier: 1 },
  { id: "business", label: "Business", multiplier: 2.6 },
  { id: "first", label: "First", multiplier: 4.2 },
];

export function cabinMultiplier(cabinClass) {
  return CABIN_CLASSES.find((c) => c.id === cabinClass)?.multiplier ?? 1;
}
