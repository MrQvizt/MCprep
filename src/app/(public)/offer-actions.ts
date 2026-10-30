"use server";

import { ensureOfferWindowStarted } from "@/lib/offer-window-server";

/**
 * Start this visitor's personal offer window (e.g. "order within 2 hours")
 * the first time they see the offer. Never restarts an existing window.
 */
export async function startOfferWindowAction(): Promise<{ startedAt: string; serverNow: string } | null> {
  const now = new Date();
  const started = await ensureOfferWindowStarted(now);
  return started ? { startedAt: started.toISOString(), serverNow: now.toISOString() } : null;
}
