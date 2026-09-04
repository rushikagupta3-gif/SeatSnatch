import { Router } from "express";
import multer from "multer";
import { createWorker } from "tesseract.js";
import { db } from "../db/db.js";
import { putPassport, getPassportMasked } from "../vault/cryptoVault.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

profileRouter.get("/", (req, res) => {
  const row = db
    .prepare(`SELECT full_name, date_of_birth, nationality, passport_issuing_country FROM passenger_profiles WHERE user_id = ?`)
    .get(req.userId);

  res.json({
    fullName: row?.full_name ?? "",
    dateOfBirth: row?.date_of_birth ?? "",
    nationality: row?.nationality ?? "",
    passportIssuingCountry: row?.passport_issuing_country ?? "",
    passport: getPassportMasked(req.userId), // masked — raw passport number/expiry never returned here
  });
});

/**
 * Saves the profile. Non-sensitive fields go to the general DB; passport
 * number/expiry (and image, if provided) go only to the encrypted vault
 * store. This is the single write path — manual entry and the OCR review
 * step both end up here, so nothing is ever auto-saved without the user
 * explicitly submitting this form.
 */
profileRouter.put("/", (req, res) => {
  const { fullName, dateOfBirth, nationality, passportIssuingCountry, passportNumber, passportExpiry, passportImageBase64 } =
    req.body || {};

  if (!fullName || !dateOfBirth || !nationality) {
    return res.status(400).json({ error: "fullName, dateOfBirth, and nationality are required" });
  }

  db.prepare(
    `INSERT INTO passenger_profiles (user_id, full_name, date_of_birth, nationality, passport_issuing_country, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name, date_of_birth=excluded.date_of_birth,
       nationality=excluded.nationality, passport_issuing_country=excluded.passport_issuing_country, updated_at=excluded.updated_at`
  ).run(req.userId, fullName, dateOfBirth, nationality, passportIssuingCountry ?? null, new Date().toISOString());

  // Both fields must arrive together — a silent partial save (e.g. number
  // typed but expiry left blank) previously left the profile looking
  // "saved" while the passport was never actually written to the vault.
  if ((passportNumber && !passportExpiry) || (!passportNumber && passportExpiry)) {
    return res.status(400).json({ error: "passportNumber and passportExpiry must both be provided together" });
  }
  if (passportNumber && passportExpiry) {
    putPassport(req.userId, { passportNumber, passportExpiry, passportImageBase64: passportImageBase64 ?? null });
  } else if (!getPassportMasked(req.userId)) {
    // Neither field was provided and there's no existing passport on file —
    // the profile is still incomplete. Say so instead of returning ok:true.
    return res.status(400).json({ error: "passportNumber and passportExpiry are required to complete your profile" });
  }

  res.json({ ok: true, passport: getPassportMasked(req.userId) });
});

/**
 * OCR pre-fill step. Returns EXTRACTED SUGGESTIONS ONLY — nothing is saved
 * here. The frontend must show these in an editable review form and the
 * user must explicitly submit PUT /api/profile to persist anything.
 */
profileRouter.post("/scan-passport", upload.single("passport"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "a passport image file is required (field name: passport)" });

  try {
    const worker = await createWorker("eng");
    const {
      data: { text },
    } = await worker.recognize(req.file.buffer);
    await worker.terminate();

    res.json({ extracted: extractPassportFields(text), rawImageBase64: req.file.buffer.toString("base64") });
  } catch (err) {
    // Deliberately do not log `err` details that could include OCR'd text
    // (which may contain the passport number) — log only that OCR failed.
    res.status(500).json({ error: "OCR processing failed" });
  }
});

/**
 * Very rough MRZ/heuristic field extraction for demo purposes — real
 * passport OCR would parse the machine-readable zone (ICAO 9303 format)
 * properly. This is intentionally simple; the review step is what makes it
 * safe to ship, not the extraction accuracy.
 */
function extractPassportFields(text) {
  const passportNumberMatch = text.match(/\b[A-Z0-9]{6,9}\b/);
  const dateMatch = text.match(/\b(\d{2}[\/\-.]\d{2}[\/\-.]\d{2,4})\b/g) || [];
  const nameMatch = text.match(/\b([A-Z]{2,})\s+([A-Z]{2,})\b/);

  return {
    passportNumber: passportNumberMatch?.[0] ?? "",
    passportExpiry: dateMatch[1] ?? dateMatch[0] ?? "",
    fullName: nameMatch ? `${nameMatch[1]} ${nameMatch[2]}` : "",
    confidence: "low — always review before saving",
  };
}
