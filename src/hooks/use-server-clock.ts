"use client";

import { useSyncExternalStore } from "react";

// Offset between the server clock and this device's clock, per server timestamp.
const skews = new Map<string, number>();

function subscribe(listener: () => void) {
  const id = window.setInterval(listener, 1000);
  return () => window.clearInterval(id);
}

/**
 * Current time in whole seconds, corrected to the server's clock (so a wrong
 * device clock doesn't change a countdown). During SSR/hydration it returns
 * the server time, so markup matches.
 */
export function useServerClockSeconds(serverNow: string): number {
  const serverMs = new Date(serverNow).getTime();
  return useSyncExternalStore(
    subscribe,
    () => {
      let skew = skews.get(serverNow);
      if (skew === undefined) {
        skew = serverMs - Date.now();
        skews.set(serverNow, skew);
      }
      return Math.floor((Date.now() + skew) / 1000);
    },
    () => Math.floor(serverMs / 1000),
  );
}
