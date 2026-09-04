import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { db } from "./db.js";
import { putPassport } from "../vault/cryptoVault.js";

/**
 * Seeds a demo account with entirely fictional passport data, for use in
 * the live demo so no one has to type in real identity documents on stage.
 * Run: `npm run seed-demo-account`
 */
const DEMO_EMAIL = "demo@seatsnatch.test";
const DEMO_PASSWORD = "demo-password-123";

async function main() {
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(DEMO_EMAIL);
  const userId = existing?.id ?? nanoid(12);

  if (!existing) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    db.prepare(`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`).run(
      userId,
      DEMO_EMAIL,
      passwordHash,
      new Date().toISOString()
    );
    console.log(`Created demo user: ${DEMO_EMAIL}`);
  } else {
    console.log(`Demo user already exists: ${DEMO_EMAIL}`);
  }

  db.prepare(
    `INSERT INTO passenger_profiles (user_id, full_name, date_of_birth, nationality, passport_issuing_country, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name, date_of_birth=excluded.date_of_birth,
       nationality=excluded.nationality, passport_issuing_country=excluded.passport_issuing_country, updated_at=excluded.updated_at`
  ).run(userId, "Jordan A. Traveller", "1990-01-01", "Fictionland", "Fictionland", new Date().toISOString());

  // Entirely fake — never use real passport data anywhere in this app.
  putPassport(userId, { passportNumber: "P0000000", passportExpiry: "2099-01-01", passportImageBase64: null });

  console.log(`\nDemo account ready:`);
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log(`  passport: P0000000 (fictional, for demo use only)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed demo account:", err.message);
  process.exit(1);
});
