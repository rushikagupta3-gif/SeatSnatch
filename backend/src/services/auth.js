import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-jwt-secret-do-not-use-in-production";
const JWT_EXPIRY = "12h";
const BCRYPT_ROUNDS = 12;

export async function signup(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(normalizedEmail);
  if (existing) {
    const err = new Error("An account with this email already exists");
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = nanoid(12);
  db.prepare(`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`).run(
    id,
    normalizedEmail,
    passwordHash,
    new Date().toISOString()
  );

  return issueToken({ id, email: normalizedEmail });
}

export async function login(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare(`SELECT id, email, password_hash FROM users WHERE email = ?`).get(normalizedEmail);
  // Constant-shape error regardless of whether the email exists, to avoid
  // leaking account existence — never log the password or hash either way.
  const invalid = () => {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  };
  if (!user) invalid();

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) invalid();

  return issueToken({ id: user.id, email: user.email });
}

function issueToken({ id, email }) {
  const token = jwt.sign({ sub: id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  return { token, user: { id, email } };
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET); // throws on invalid/expired
}
