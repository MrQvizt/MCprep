"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Flame } from "lucide-react";
import { pad2 as pad, useOfferCountdown } from "./use-offer-countdown";

export interface OfferBarPromo {
  slug: string;
  headline: string;
  shortLabel: string;
  windowMinutes: number;
  endsAt: string;
  newCustomersOnly: boolean;
}

/**
 * Site-wide bar for an offer with a personal deadline ("order within 2
 * hours"). The window starts the first time the visitor sees it and is kept
 * by the server, so the countdown is the same on every page and reload. It
 * disappears when the visitor's window has ended.
 */
export function OfferBar({ promo, startedAt, serverNow }: { promo: OfferBarPromo; startedAt: string | null; serverNow: string }) {
  const pathname = usePathname();
  // The homepage and the order page show their own, bigger offer card.
  const ownCard = pathname === "/" || pathname.startsWith("/order");
  const { remaining } = useOfferCountdown({
    windowMinutes: promo.windowMinutes,
    endsAt: promo.endsAt,
    startedAt,
    serverNow,
    autoStart: !ownCard,
  });

  if (remaining <= 0 || ownCard) return null;

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
