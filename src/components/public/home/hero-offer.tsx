"use client";

import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { pad2, useOfferCountdown } from "../use-offer-countdown";

export interface HeroOfferData {
  slug: string;
  /** e.g. "First week €6 a meal" */
  title: string;
  /** e.g. "10 meals for €60 instead of €95 — save €35" */
  example: string | null;
  /** e.g. "Claim €6 meals" */
  ctaLabel: string;
  windowMinutes: number;
  endsAt: string;
  newCustomersOnly: boolean;
  startedAt: string | null;
  serverNow: string;
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex min-w-[3.25rem] flex-col items-center bg-ink px-2 py-1.5 text-white sm:min-w-[4rem] sm:py-2">
      <span className="font-display text-2xl font-black leading-none tabular sm:text-4xl">{pad2(value)}</span>
      <span className="mt-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-white/60">{label}</span>
    </span>
  );
}

/**
 * The "order within 2 hours" first-week offer, at the top of the homepage:
 * big price, the saving, and the visitor's own countdown (same deadline on
 * every page and reload). Hidden once the visitor's window has ended.
 */
export function HeroOffer({ offer, className }: { offer: HeroOfferData; className?: string }) {
  const { remaining, hours, minutes, seconds } = useOfferCountdown({
    windowMinutes: offer.windowMinutes,
    endsAt: offer.endsAt,
    startedAt: offer.startedAt,
    serverNow: offer.serverNow,
  });
  if (remaining <= 0) return null;

  return (
    <section
      aria-label="New customer offer"
      data-promotion={offer.slug}
      className={cn(
        "light relative bg-white text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-top-2 duration-700",
        className,
      )}
    >
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto_auto] lg:items-center lg:gap-8">
        <div>
          <p className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-ink/70">
            <Flame className="size-4 text-red-600" aria-hidden="true" />
            {offer.newCustomersOnly && <span className="text-red-600">New here?</span>}
            {offer.newCustomersOnly ? <span aria-hidden="true">·</span> : null}
            <span>Limited time</span>
          </p>
          <p className="mt-2 font-display text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-4xl">{offer.title}</p>
          {offer.example && <p className="mt-2 text-sm font-medium text-ink/75 sm:text-base">{offer.example}</p>}
        </div>
        <div>
          <p className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink/70">Your price is held for</p>
          <div role="timer" aria-label={`${hours} hours ${minutes} minutes left`} className="flex gap-1.5">
            <Unit value={hours} label="hrs" />
            <Unit value={minutes} label="min" />
            <Unit value={seconds} label="sec" />
          </div>
        </div>
        <Link
          href="/order"
          data-track="select_promotion"
          data-track-promotion={offer.slug}
          className="group inline-flex h-14 items-center justify-center gap-2 bg-ink px-6 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-charcoal"
        >
          {offer.ctaLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
