import "server-only";
import { cookies } from "next/headers";
import {
  OFFER_WINDOW_COOKIE,
  OFFER_WINDOW_COOKIE_MAX_AGE,
  offerWindowSecret,
  signOfferWindow,
  verifyOfferWindow,
} from "@/lib/offer-window";

/** When this visitor's personal offer window started (read-only; usable in Server Components). */
export async function getOfferWindowStart(now = new Date()): Promise<Date | null> {
  const secret = offerWindowSecret();
  if (!secret) return null;
  const store = await cookies();
  return verifyOfferWindow(store.get(OFFER_WINDOW_COOKIE)?.value, secret, now);
}

/**
 * Start the visitor's offer window if it hasn't started yet and return the
 * start time. Only callable from Server Functions / Route Handlers (sets a cookie).
 */
export async function ensureOfferWindowStarted(now = new Date()): Promise<Date | null> {
  const secret = offerWindowSecret();
  if (!secret) return null;
  const store = await cookies();
  const existing = verifyOfferWindow(store.get(OFFER_WINDOW_COOKIE)?.value, secret, now);
  if (existing) return existing;
  store.set(OFFER_WINDOW_COOKIE, signOfferWindow(now.getTime(), secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OFFER_WINDOW_COOKIE_MAX_AGE,
  });
  return now;
}
