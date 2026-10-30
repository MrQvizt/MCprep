"use client";

import { useEffect, useState } from "react";
import { startOfferWindowAction } from "@/app/(public)/offer-actions";
import { Countdown } from "@/components/shared/countdown";

/**
 * Countdown for a promotion. Offers with a personal deadline ("order within
 * 2 hours") count down to this visitor's own deadline (started the first
 * time they see the offer and kept by the server); others to the campaign end.
 */
export function PromoCountdown({
  endsAt,
  personalWindowMinutes,
  serverNow,
  size = "md",
  label,
  refreshOnEnd = true,
  className,
}: {
  endsAt: string;
  personalWindowMinutes: number | null;
  serverNow: string;
  size?: "sm" | "md" | "lg";
  label?: string;
  refreshOnEnd?: boolean;
  className?: string;
}) {
  const [window, setWindow] = useState<{ startedAt: string; serverNow: string } | null>(null);
  useEffect(() => {
    if (!personalWindowMinutes) return;
    let cancelled = false;
    void startOfferWindowAction().then((r) => {
      if (!cancelled && r) setWindow(r);
    });
    return () => {
      cancelled = true;
    };
  }, [personalWindowMinutes]);

  if (!personalWindowMinutes) {
    return <Countdown endsAt={endsAt} serverNow={serverNow} size={size} label={label} refreshOnEnd={refreshOnEnd} className={className} />;
  }
  if (!window) {
    // Reserve the space while the visitor's window loads.
    return <div aria-hidden="true" className={size === "lg" ? "h-28" : "h-16"} />;
  }
  const deadline = Math.min(new Date(window.startedAt).getTime() + personalWindowMinutes * 60_000, new Date(endsAt).getTime());
  return (
    <Countdown
      endsAt={new Date(deadline).toISOString()}
      serverNow={window.serverNow}
      size={size}
      label={label ?? "Order within"}
      refreshOnEnd={false}
      endedLabel="Your window for this offer has ended"
      className={className}
    />
  );
}
