import compact from "./airports.json";

// Every airport in the world with an assigned IATA code (~8,800), sourced
// from the public OurAirports dataset. Stored compact on disk ([code, city,
// country, name] tuples) and expanded once here to keep the bundle small.
export const AIRPORTS = compact.map(([code, city, country, name]) => ({ code, city, country, name }));

// Shown before the user types anything — the world's busiest hubs, so the
// list isn't just an arbitrary alphabetical slice of 8,800 airports.
export const POPULAR_CODES = [
  "JFK", "LHR", "DXB", "LAX", "CDG", "SIN", "HND", "SFO", "ORD", "AMS",
  "FRA", "HKG", "ATL", "SYD", "ICN", "BOM", "DEL", "GRU", "YYZ", "MAD",
];
