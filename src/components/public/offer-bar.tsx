"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Flame } from "lucide-react";
import { startOfferWindowAction } from "@/app/(public)/offer-actions";
import { useServerClockSeconds } from "@/hooks/use-server-clock";

export interface OfferBarPromo {
  slug: string;
  headline: string;
  shortLabel: string;
  windowMinutes: number;
  endsAt: string;
  newCustomersOnly: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Site-wide bar for an offer with a personal deadline ("order within 2
 * hours"). The window starts the first time the visitor sees it and is kept
 * by the server, so the countdown is the same on every page and reload. It
 * disappears when the visitor's window has ended.
 */
export function OfferBar({ promo, startedAt: initialStart, serverNow: initialNow }: { promo: OfferBarPromo; startedAt: string | null; serverNow: string }) {
  const pathname = usePathname();
  const [startedAt, setStartedAt] = useState(initialStart);
  const [serverNow, setServerNow] = useState(initialNow);

  useEffect(() => {
    if (startedAt) return;
    let cancelled = false;
    void startOfferWindowAction().then((r) => {
      if (cancelled || !r) return;
      setServerNow(r.serverNow);
      setStartedAt(r.startedAt);
    });
    return () => {
      cancelled = true;
    };
  }, [startedAt]);

  const deadline = useMemo(() => {
    const start = startedAt ? new Date(startedAt).getTime() : new Date(serverNow).getTime();
    return Math.min(start + promo.windowMinutes * 60_000, new Date(promo.endsAt).getTime());
  }, [startedAt, serverNow, promo.windowMinutes, promo.endsAt]);
  const nowSec = useServerClockSeconds(serverNow);
  const remaining = Math.max(0, Math.floor(deadline / 1000) - nowSec);

  // The order page shows its own offer card.
  if (remaining <= 0 || pathname.startsWith("/order")) return null;

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const clock = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;

  return (
    <div className="border-b border-white/10 bg-white text-ink" data-promotion={promo.slug} role="region" aria-label="Offer">
      <Link
        href="/order"
        data-track="select_promotion"
        data-track-promotion={promo.slug}
        className="container-site flex min-h-11 items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-[0.72rem] font-semibold uppercase tracking-[0.12em] sm:text-xs"
      >
        <Flame className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="hidden sm:inline">{promo.newCustomersOnly ? "New here? " : ""}</span>
          {promo.shortLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="hidden sm:inline font-normal normal-case tracking-normal">ends in</span>
          <span role="timer" aria-label={`${h} hours ${m} minutes left`} className="bg-ink px-2 py-0.5 font-display tabular tracking-normal text-white">
            {clock}
          </span>
        </span>
        <span className="hidden items-center gap-1 underline underline-offset-4 md:inline-flex">
          Build your package <ArrowRight className="size-3.5" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}
