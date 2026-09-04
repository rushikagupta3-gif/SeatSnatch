import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DB_PATH = path.join(__dirname, "../data/vault.db");

/**
 * VAULT-PATTERN STORE (mock, not real HashiCorp Vault).
 *
 * DISCLOSED SIMPLIFICATION: standing up real Vault (dev-mode server, unseal,
 * auth method, policy, client wiring) is real infra work with no demo payoff
 * and one more external service that can fail on stage. This module
 * demonstrates the same security pattern Vault would provide — passport
 * data physically separated from the general database, encrypted at rest,
 * decrypted only at the point of use, never returned raw over any API,
 * never logged — using Node's built-in `crypto` (AES-256-GCM) against its
 * own SQLite file. A production swap to real Vault only needs this file
 * rewritten to call Vault's Transit/KV engine instead of `crypto` directly;
 * every call site elsewhere (getPassport/putPassport/deletePassport) is
 * unchanged.
 *
 * The master key here is a local dev key (VAULT_MASTER_KEY env var, falls
 * back to a fixed dev-only value) — in production this would be Vault's own
 * key management (auto-unseal, KMS-backed), never a value living in this
 * codebase.
 */

const MASTER_KEY = crypto
  .createHash("sha256")
  .update(process.env.VAULT_MASTER_KEY || "dev-only-insecure-master-key-do-not-use-in-production")
  .digest();

fs.mkdirSync(path.dirname(VAULT_DB_PATH), { recursive: true });
const vaultDb = new Database(VAULT_DB_PATH);
vaultDb.pragma("journal_mode = WAL");

vaultDb.exec(`
  CREATE TABLE IF NOT EXISTS passport_vault (
    user_id TEXT PRIMARY KEY,
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function encrypt(plaintextObj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", MASTER_KEY, iv);
  const plaintext = JSON.stringify(plaintextObj);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: authTag.toString("base64") };
}

function decrypt({ ciphertext, iv, authTag }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", MASTER_KEY, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

/**
 * Stores passport data for a user. `data` shape:
 * { passportNumber, passportExpiry, passportImageBase64? }
 * Encrypted at rest; the caller's plaintext is never persisted anywhere else.
 */
export function putPassport(userId, data) {
  const { ciphertext, iv, authTag } = encrypt(data);
  vaultDb
    .prepare(
      `INSERT INTO passport_vault (user_id, ciphertext, iv, auth_tag, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, auth_tag = excluded.auth_tag, updated_at = excluded.updated_at`
    )
    .run(userId, ciphertext, iv, authTag, new Date().toISOString());
}

/** Decrypts and returns the full passport record. Only call this at the point of actual use (booking submission, profile review screen) — never log the result. */
export function getPassport(userId) {
  const row = vaultDb.prepare(`SELECT ciphertext, iv, auth_tag as authTag FROM passport_vault WHERE user_id = ?`).get(userId);
  if (!row) return null;
  return decrypt(row);
}

/** Returns whether a passport record exists, and a masked preview — safe to include in general API responses. */
export function getPassportMasked(userId) {
  const full = getPassport(userId);
  if (!full) return null;
  const num = full.passportNumber || "";
  const masked = num.length > 4 ? `${num.slice(0, 2)}${"•".repeat(Math.max(0, num.length - 4))}${num.slice(-2)}` : "••••";
  return { passportNumberMasked: masked, passportExpiry: full.passportExpiry, hasImage: !!full.passportImageBase64 };
}

export function deletePassport(userId) {
  vaultDb.prepare(`DELETE FROM passport_vault WHERE user_id = ?`).run(userId);
}
