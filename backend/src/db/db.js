import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../data/app.db");

/**
 * General-purpose application data store — accounts, non-sensitive profile
 * fields, booking records. Deliberately holds NOTHING passport-related; that
 * lives only in vault/cryptoVault.js's physically separate store.
 *
 * DISCLOSED SIMPLIFICATION: this is SQLite (via better-sqlite3), standing in
 * for Postgres for the hackathon demo — no local Postgres server available
 * and standing one up adds real setup/runtime risk for zero demo payoff.
 * The schema and query shapes here are plain SQL and would move to a real
 * Postgres instance with only this file changing (swap the driver, keep the
 * same `query`/`get`/`run` call sites).
 */

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS passenger_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    full_name TEXT,
    date_of_birth TEXT,
    nationality TEXT,
    passport_issuing_country TEXT,
    -- NOTE: passport number and passport expiry are intentionally NOT here.
    -- They live only in the encrypted vault store, keyed by user_id.
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    session_id TEXT,
    leg TEXT,
    offer_id TEXT,
    confirmation_code TEXT,
    settlement_tx_hash TEXT,
    created_at TEXT NOT NULL
  );
`);
