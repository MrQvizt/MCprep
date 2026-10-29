import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Personal offer windows ("order within the next 2 hours").
 *
 * The first time a visitor sees a personal-deadline offer, the server stores
 * the start time in a signed, HTTP-only cookie. The deadline is derived from
 * it on the server for every quote and order, so reloading the page never
 * restarts the countdown and the browser can't extend it.
 */

export const OFFER_WINDOW_COOKIE = "mc_offer_window";
/** How long the start time is remembered (an expired window stays expired). */
export const OFFER_WINDOW_COOKIE_MAX_AGE = 180 * 24 * 60 * 60;
const VERSION = "v1";
const MAX_AGE_MS = 365 * 86_400_000;
const CLOCK_SKEW_MS = 60_000;

function signature(startMs: number, secret: string): string {
  return createHmac("sha256", secret).update(`offer-window:${VERSION}:${startMs}`).digest("base64url").slice(0, 32);
}

export function signOfferWindow(startMs: number, secret: string): string {
  return `${VERSION}.${startMs}.${signature(startMs, secret)}`;
}

/** Start time from a cookie value, or null when missing, tampered with or implausible. */
export function verifyOfferWindow(value: string | null | undefined, secret: string, now: Date): Date | null {
  if (!value) return null;
  const [version, startRaw, sig] = value.split(".");
  if (version !== VERSION || !startRaw || !sig || !/^\d{10,16}$/.test(startRaw)) return null;
  const startMs = Number(startRaw);
  const expected = Buffer.from(signature(startMs, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (startMs > now.getTime() + CLOCK_SKEW_MS || startMs < now.getTime() - MAX_AGE_MS) return null;
  return new Date(startMs);
}

export function offerWindowSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.HASH_SALT || null;
}
