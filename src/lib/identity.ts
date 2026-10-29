import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "MT";

/** Lower-cased, trimmed email used for storage and display. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Canonical mailbox used for identity matching only (never shown to users):
 * removes "+tag" sub-addressing and Gmail's ignored dots, so obvious repeat
 * sign-ups for first-order offers can be detected.
 */
export function canonicalEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at < 1) return normalized;
  let local = normalized.slice(0, at);
  let domain = normalized.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** Parse a phone number (Maltese by default) into E.164, or null if invalid. */
export function normalizePhone(input: string, defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withPlus = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
  const parsed = parsePhoneNumberFromString(withPlus, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** "+35679123456" → "+356 7912 3456" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

/** Digits-only form used by wa.me links ("35679123456"). */
export function phoneDigits(e164: string | null | undefined): string {
  return (e164 ?? "").replace(/\D/g, "");
}
