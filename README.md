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
| Flight inventory / fare availability | **Mocked** — a GDS-style in-memory service we built (IATA-style `Y3`/`Y0` availability codes). Real GDS access (Amadeus/Sabre) isn't obtainable in a hackathon window; Amadeus's free sandbox has shut down. |
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

Agent decision logic is a deterministic rules/heuristics engine (no LLM call) — this was a
deliberate choice for demo reliability: zero external-dependency latency or failure risk on
stage. See `backend/src/services/scoring.js`.

## Setup

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Pre-fund demo wallets (run once before the demo, or whenever wallets run low)

```bash
cd backend
npm run fund-wallets   # generates + funds traveller/agent/airline wallets via the public XRPL Testnet faucet
npm run fund-rlusd     # opens RLUSD trustlines and issues demo RLUSD to the traveller wallet
```

This caches credentials to `backend/src/data/wallets.json` (gitignored, testnet-only, no real
value) so the live demo never makes a live faucet call.

Each full demo run spends real XRP/RLUSD from these testnet wallets (escrow release + optional
RLUSD payment). Re-run `fund-wallets` / `fund-rlusd` if balances run low before a rehearsal.

### 3. Seed the demo account

```bash
cd backend
npm run seed-demo-account
```

Creates `demo@seatsnatch.test` / `demo-password-123` with a complete profile using entirely
fictional passport data (`P0000000`) — use this for the live demo instead of typing in real
identity documents on stage. Prints the credentials to console for convenience (safe — they're
fake).

### 4. Pre-warm passport OCR (optional, recommended before a live demo)

The "Scan passport" feature downloads a ~5MB language model on its first use. Run one scan
locally before going on stage so that download isn't happening live:

```bash
cd backend
node -e "import('tesseract.js').then(({createWorker}) => createWorker('eng')).then(() => process.exit(0))"
```

After this, `backend/eng.traineddata` is cached and every subsequent OCR call is fully offline.

### 5. Run both servers

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
2. Watch the live reasoning panel: every fare's availability code, expected-cost score (price +
   layover time cost + layover risk cost), and depletion projection update every ~2.5s.
3. Use the **Demo controls** to force a fare to deplete on cue (`Deplete offer_X`), live on stage.
4. When the agent commits to a fare, watch the log: `x402` 402 response → escrow release (or, for
   the GBP-priced fare, an RLUSD conversion + payment) → retried request → confirmed ticket, with
   a real XRPL Testnet transaction hash linking to the explorer.
5. `Reset inventory` restores the seeded fares for another run.
6. Once a leg is booked, a **"Simulate price drop"** button appears in Demo controls. Click it and
   within ~4s the agent detects the drop and automatically settles a micro-refund back to the
   traveller — shown on the ticket card with its own XRPL transaction link.
7. The full agent reasoning trace (fare-by-fare scoring, depletion projections, and the
   timestamped event log) is hidden by default so the ticket stays front-and-center — click
   **"Show agent reasoning"** to reveal it.

Round-trip, cabin class, multi-airline selection, and free-text notes are also supported from the
objective form — round-trip runs two legs independently (each with its own reasoning panel) and
enforces a combined-spend guard so the two legs together can never exceed the authorized budget.

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
- `backend/src/xrpl/payment.js` — plain XRP Payment used for price-drop micro-refunds
- `backend/src/vault/cryptoVault.js` — the Vault-pattern encrypted passport store (see table above)
- `backend/src/db/db.js` — the general data store (users, non-sensitive profile fields, bookings)
- `backend/src/services/auth.js` — bcrypt + JWT signup/login
- `backend/src/services/passenger.js` — the ONLY place passport data is decrypted for actual use (booking)
- `frontend/src/components/ReasoningPanel.jsx` — the live "watch it compute" panel (toggle-shown)
- `frontend/src/components/ProfilePage.jsx` — passenger profile, manual entry + OCR-with-review
