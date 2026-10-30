"use client";

import { useEffect, useMemo, useState } from "react";
import { startOfferWindowAction } from "@/app/(public)/offer-actions";
import { useServerClockSeconds } from "@/hooks/use-server-clock";

/**
 * Seconds left in this visitor's personal offer window ("order within 2
 * hours"). The window starts the first time the visitor sees the offer and is
 * kept by the server (signed cookie), so it never restarts on reload.
 */
export function useOfferCountdown({
  windowMinutes,
  endsAt,
  startedAt: initialStart,
  serverNow: initialNow,
  autoStart = true,
}: {
  windowMinutes: number;
  endsAt: string;
  startedAt: string | null;
  serverNow: string;
  /** Start the window if it hasn't started (only one component per page should). */
  autoStart?: boolean;
}) {
  const [startedAt, setStartedAt] = useState(initialStart);
  const [serverNow, setServerNow] = useState(initialNow);

  useEffect(() => {
    if (startedAt || !autoStart) return;
    let cancelled = false;
    void startOfferWindowAction().then((r) => {
      if (cancelled || !r) return;
      setServerNow(r.serverNow);
      setStartedAt(r.startedAt);
    });
    return () => {
      cancelled = true;
    };
  }, [startedAt, autoStart]);

  const deadline = useMemo(() => {
    const start = startedAt ? new Date(startedAt).getTime() : new Date(serverNow).getTime();
    return Math.min(start + windowMinutes * 60_000, new Date(endsAt).getTime());
  }, [startedAt, serverNow, windowMinutes, endsAt]);
  const nowSec = useServerClockSeconds(serverNow);
  const remaining = Math.max(0, Math.floor(deadline / 1000) - nowSec);
  return {
    remaining,
    hours: Math.floor(remaining / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
  };
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
