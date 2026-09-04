import { db } from "../db/db.js";
import { getPassport } from "../vault/cryptoVault.js";

/**
 * Internal-only accessor: pulls full passenger details (including raw
 * passport number/expiry from the vault) for the ONE legitimate reason to
 * decrypt them — submitting a booking. Never expose this over an HTTP
 * response; never log its return value.
 */
export function getPassengerForBooking(userId) {
  const profile = db
    .prepare(`SELECT full_name, date_of_birth, nationality, passport_issuing_country FROM passenger_profiles WHERE user_id = ?`)
    .get(userId);
  if (!profile) return null;

  const passport = getPassport(userId);
  if (!passport) return null;

  return {
    fullName: profile.full_name,
    dateOfBirth: profile.date_of_birth,
    nationality: profile.nationality,
    passportIssuingCountry: profile.passport_issuing_country,
    passportNumber: passport.passportNumber,
    passportExpiry: passport.passportExpiry,
  };
}

export function hasCompleteProfile(userId) {
  return getPassengerForBooking(userId) !== null;
}
