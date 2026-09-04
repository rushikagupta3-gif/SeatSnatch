# SeatSnatch — Autonomous Flight-Booking Agent on XRPL

Singhacks 2026 — Ripple Track. A travel agent that sets constraints once (route, dates, max price,
how much a safer/shorter layover is worth), then an autonomous agent monitors a live, depleting
fare market and books — with payment pre-authorized and settled on XRPL — the moment its
conditions are met. No human clicks "confirm" per transaction.

## What's real vs. mocked (disclosed up front)

| Component | Status |
|---|---|
| XRPL Testnet transactions (EscrowCreate/EscrowFinish, IOU Payments) | **Real** — actual Testnet transactions, verifiable on the explorer |
| x402 "402 Payment Required" flow | **Real** HTTP round-trip (402 → settle → retry with proof), minimal but spec-correct implementation |
| Flight search | **Real API call, test-mode data** — every session searches live via the [Duffel](https://duffel.com) API (`backend/src/services/duffelClient.js`), a real flight-search API with a real key. Duffel's *test mode* returns realistic synthetic offers (mixed with a placeholder "Duffel Airways" carrier alongside real airline names) rather than live bookable seats — this is Duffel's own sanctioned way to develop without touching real airline systems or money, not something we mocked ourselves. No GDS exposes real seat counts competitively, so `seatsRemaining` is synthesized per offer for the live depletion demo (disclosed in code). Falls back to a small built-in mock list if Duffel is unreachable, so a network hiccup never blocks the live demo. |
| Agent's natural-language reasoning | **Real LLM call** — a real Groq API call (`backend/src/services/groqClient.js`, `openai/gpt-oss-20b`, free tier) generates the agent's plain-English explanation of its choice, shown in the reasoning panel tagged `AI`. This is advisory only: the deterministic scoring engine (below) still decides what actually gets purchased, so a slow/failed LLM call never blocks or changes a real booking — it just means that round has no AI commentary logged. |
| Layover delay-risk scores | **Mocked** — a small hardcoded dataset of "delay-prone" vs. "punctual" airports. Production would use real on-time performance data. |
| RLUSD | **Testnet-issued stand-in** — the public RLUSD testnet faucet (tryrlusd.com) wasn't reachable from this build environment and its flow is a manual, captcha-gated web form. Our own "airline" wallet issues a testnet-only IOU using the real RLUSD currency code instead, so the on-chain mechanics (TrustSet, IOU Payment, near-instant finality) are identical to genuine RLUSD — only the issuer differs. This is disclosed in the code and here, not hidden. |
| Ticket confirmation | **Simulated** — a mock PNR/confirmation code, no real airline booking occurs |
| Wallet funding | Pre-funded before the demo via the real public XRPL Testnet faucet, cached locally, so the live demo doesn't depend on a live faucet call on stage (rate limits / latency risk) |
| HashiCorp Vault (passport storage) | **Vault-pattern mock, not real Vault** — standing up real Vault (dev server, unseal, auth method, policy) is real infra work with no demo payoff and one more thing that can fail on stage. `backend/src/vault/cryptoVault.js` demonstrates the same security pattern (physically separate store, AES-256-GCM encryption at rest, decrypt-only-at-point-of-use, never returned raw over any API, never logged) using Node's built-in `crypto` against its own SQLite file. A production swap to real Vault only touches this one file — every call site (`getPassport`/`putPassport`) stays the same. |
| PostgreSQL | **SQLite stand-in** (`backend/src/db/db.js`) — no local Postgres server available; same plain-SQL query shapes, same file to swap for a real Postgres driver later. |
| Passport OCR | **Real, local, no cloud API** — `tesseract.js` running in-process. Downloads a ~5MB English language model to `backend/eng.traineddata` on first use (one-time network dependency — see Setup), then runs fully offline. Extraction is heuristic/regex-based, not a real MRZ parser — the mandatory review-before-save step is what makes this safe to ship, not the extraction accuracy. |

No real money is used anywhere. XRPL Testnet only.

## Architecture

```
/backend   Node.js + Express — mock inventory, agent decision loop, x402 flow, XRPL escrow/RLUSD
/frontend  React (Vite) + Tailwind — objective form, live reasoning panel, ticket confirmation
```

The actual purchase decision is a deterministic rules/heuristics engine (`backend/src/services/scoring.js`)
— chosen so the booking itself never depends on LLM latency or output. A real LLM call (Groq) runs
alongside it purely to generate the agent's natural-language explanation, logged but never gating
the transaction — see `backend/src/services/groqClient.js`.

## Setup

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Add your API keys

Create `backend/.env` (gitignored — never committed) with:

```
DUFFEL_API_KEY=duffel_test_...   # free at https://duffel.com — no card required
GROQ_API_KEY=gsk_...             # free at https://console.groq.com — no card required
```

Both are optional in the sense that the app degrades gracefully without them (falls back to
built-in mock fares, skips the AI commentary), but the live flight search and the agent's
natural-language reasoning need them to actually run.

### 3. Pre-fund demo wallets (run once before the demo, or whenever wallets run low)

```bash
cd backend
npm run fund-wallets   # generates + funds traveller/agent/airline wallets via the public XRPL Testnet faucet
npm run fund-rlusd     # opens RLUSD trustlines and issues demo RLUSD to the traveller wallet
```

This caches credentials to `backend/src/data/wallets.json` (gitignored, testnet-only, no real
value) so the live demo never makes a live faucet call.

Each full demo run spends real XRP/RLUSD from these testnet wallets (escrow release + optional
RLUSD payment). Re-run `fund-wallets` / `fund-rlusd` if balances run low before a rehearsal.

### 4. Seed the demo account

```bash
cd backend
npm run seed-demo-account
```

Creates `demo@seatsnatch.test` / `demo-password-123` with a complete profile using entirely
fictional passport data (`P0000000`) — use this for the live demo instead of typing in real
identity documents on stage. Prints the credentials to console for convenience (safe — they're
fake).

### 5. Pre-warm passport OCR (optional, recommended before a live demo)

The "Scan passport" feature downloads a ~5MB language model on its first use. Run one scan
locally before going on stage so that download isn't happening live:

```bash
cd backend
node -e "import('tesseract.js').then(({createWorker}) => createWorker('eng')).then(() => process.exit(0))"
```

After this, `backend/eng.traineddata` is cached and every subsequent OCR call is fully offline.

### 6. Run both servers

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev
```

Open http://localhost:5173.

## Demo flow

0. Sign in with the seeded demo account (`demo@seatsnatch.test` / `demo-password-123`) or sign
   up fresh — a new account is routed straight to a required "My Profile" screen (full name, DOB,
   nationality, passport number/expiry/issuing country) before it can book anything. The agent
   pulls these details automatically at booking time via a secure internal call — the traveller
   never re-enters them per booking. Passport number/expiry are never returned by any API in full,
   only masked (e.g. `P0••••00`); "My Profile" also supports a "Scan passport" upload with
   OCR pre-fill, but nothing is ever saved from a scan without an explicit review-and-confirm step.
1. Fill in the objective form (route, max price, value of a shorter/safer layover) and submit.
   This locks a pre-authorized XRP budget via `EscrowCreate` on XRPL Testnet.
2. The agent runs a real Duffel search for that route/date and starts evaluating the results every
   ~2.5s: expected-cost score (price + layover time cost + layover risk cost), and a depletion
   projection per fare (using synthesized seat counts, since no GDS exposes real ones).
3. If nothing fits the budget/airline filters, a banner explains that plainly and lists the
   over-budget options (never purchased) — the agent keeps monitoring automatically.
4. When the agent commits to a fare, a real Groq LLM call generates a short natural-language
   explanation of the choice (tagged `AI` in the log) — advisory only, it never gates the actual
   transaction. Then: `x402` 402 response → escrow release (or an RLUSD conversion + payment for a
   foreign-currency fare) → retried request → confirmed ticket, with a real XRPL Testnet
   transaction hash linking to the explorer.
5. The full agent reasoning trace (fare-by-fare scoring, depletion projections, the AI commentary,
   and the timestamped event log) is hidden by default so the ticket stays front-and-center — click
   **"Show agent reasoning"** to reveal it.

Round-trip, cabin class, multi-airline selection, and free-text notes are also supported from the
objective form — round-trip runs two legs independently (each with its own reasoning panel, each
searched separately via Duffel) and enforces a combined-spend guard so the two legs together can
never exceed the authorized budget.

### Optional: secrets for auth/vault

`JWT_SECRET` and `VAULT_MASTER_KEY` (set via `backend/.env`, gitignored) key the JWT signing and
the passport encryption respectively. Both fall back to fixed, clearly-named
`dev-only-insecure-*` values if unset — fine for a local demo, never for anything real.

## Isolated module sanity checks

```bash
cd backend
npm run test-escrow   # confirms an EscrowCreate -> EscrowFinish cycle works in isolation
```

## Key files

- `backend/src/xrpl/escrow.js` — native XRPL Escrow primitives (no smart contract needed)
- `backend/src/xrpl/rlusd.js` — RLUSD-style IOU issuance/settlement
- `backend/src/services/scoring.js` — the agent's depletion + expected-value reasoning
- `backend/src/services/session.js` — the agent's decision loop orchestration
- `backend/src/services/x402.js` — the 402 Payment Required flow
- `backend/src/services/duffelClient.js` — real flight search (Duffel test mode)
- `backend/src/services/groqClient.js` — real LLM reasoning commentary (Groq)
- `backend/src/vault/cryptoVault.js` — the Vault-pattern encrypted passport store (see table above)
- `backend/src/db/db.js` — the general data store (users, non-sensitive profile fields, bookings)
- `backend/src/services/auth.js` — bcrypt + JWT signup/login
- `backend/src/services/passenger.js` — the ONLY place passport data is decrypted for actual use (booking)
- `frontend/src/components/ReasoningPanel.jsx` — the live "watch it compute" panel (toggle-shown)
- `frontend/src/components/ProfilePage.jsx` — passenger profile, manual entry + OCR-with-review
