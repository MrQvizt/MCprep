"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { pad2 as pad, useOfferCountdown } from "./use-offer-countdown";

/** Whether the homepage's big deal banner is on screen (true until measured). */
function useBannerVisible(enabled: boolean) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    const banner = document.querySelector("[data-deal-banner]");
    if (!banner) return; // no banner means the deal has ended for this visitor; the bar is gone too
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 });
    io.observe(banner);
    return () => io.disconnect();
  }, [enabled]);
  return visible;
}

export interface OfferBarPromo {
  slug: string;
  headline: string;
  shortLabel: string;
  windowMinutes: number;
  endsAt: string;
  newCustomersOnly: boolean;
}

/**
 * Site-wide red bar for an offer with a personal deadline ("order within 2
 * hours"), pinned to the top with the header so it stays visible while
 * scrolling. On the front page it stays hidden while the big deal banner is
 * on screen and slides in under the header once the banner scrolls away. The window starts the first time the visitor sees the offer and
 * is kept by the server, so the countdown is the same on every page and
 * reload. It disappears when the visitor's window has ended.
 */
export function OfferBar({ promo, startedAt, serverNow }: { promo: OfferBarPromo; startedAt: string | null; serverNow: string }) {
  const pathname = usePathname();
  // The homepage and the order page start the visitor's window from their own, bigger offer card.
  const ownCard = pathname === "/" || pathname.startsWith("/order");
  const { remaining } = useOfferCountdown({
    windowMinutes: promo.windowMinutes,
    endsAt: promo.endsAt,
    startedAt,
    serverNow,
    autoStart: !ownCard,
  });

  // Front page: the big deal banner is the offer; the bar only slides in once it has scrolled away.
  const isHome = pathname === "/";
  const bannerVisible = useBannerVisible(isHome);

  if (remaining <= 0 || (isHome && bannerVisible)) return null;

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const clock = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;

  return (
    <div
      className={cn(
        "border-b border-red-700 bg-red-600 text-white",
        // Out of the page flow on the front page, so its appearing doesn't shift the content.
        isHome && "absolute inset-x-0 top-full animate-in fade-in slide-in-from-top-2 duration-300",
      )}
      data-promotion={promo.slug}
      role="region"
      aria-label="Offer"
    >
      <Link
        href="/order"
        data-track="select_promotion"
        data-track-promotion={promo.slug}
        className="container-site flex min-h-11 items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-[0.72rem] font-semibold uppercase tracking-[0.12em] sm:text-xs"
      >
        <Flame className="size-4 shrink-0" aria-hidden="true" />
        <span>
          {promo.newCustomersOnly && <span className="hidden sm:inline">New here? </span>}
          {promo.shortLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="hidden sm:inline font-normal normal-case tracking-normal">ends in</span>
          <span role="timer" aria-label={`${h} hours ${m} minutes left`} className="bg-white px-2 py-0.5 font-display tabular tracking-normal text-red-700">
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
