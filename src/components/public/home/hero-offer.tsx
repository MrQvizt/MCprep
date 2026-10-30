"use client";

import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { pad2, useOfferCountdown } from "../use-offer-countdown";

export interface HeroOfferData {
  slug: string;
  /** e.g. "First week €6 a meal" (used when there is no single deal price) */
  title: string;
  /** Deal price per meal, e.g. "€6" */
  price: string | null;
  /** Normal price per meal on the recommended package, e.g. "€9.50" */
  wasPerMeal: string | null;
  /** e.g. 37 */
  savePercent: number | null;
  /** e.g. "10 meals for €60 instead of €95 — save €35" */
  example: string | null;
  /** e.g. "Claim my €6 meals" */
  ctaLabel: string;
  windowMinutes: number;
  endsAt: string;
  newCustomersOnly: boolean;
  startedAt: string | null;
  serverNow: string;
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex min-w-[3.4rem] flex-col items-center bg-ink px-2 py-2 text-white sm:min-w-[4.25rem]">
      <span className="font-display text-3xl font-black leading-none tabular sm:text-4xl">{pad2(value)}</span>
      <span className="mt-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-white/60">{label}</span>
    </span>
  );
}

/**
 * The "order within 2 hours" first-week deal at the top of the homepage,
 * styled as an ad: red, the deal price against the normal price, the saving,
 * and the visitor's own countdown (same deadline on every page and reload).
 * Hidden once the visitor's window has ended.
 */
export function HeroOffer({ offer, className }: { offer: HeroOfferData; className?: string }) {
  const { remaining, hours, minutes, seconds } = useOfferCountdown({
    windowMinutes: offer.windowMinutes,
    endsAt: offer.endsAt,
    startedAt: offer.startedAt,
    serverNow: offer.serverNow,
  });
  if (remaining <= 0) return null;
  const hurry = remaining < 10 * 60;

  return (
    <section
      aria-label="New customer offer"
      data-promotion={offer.slug}
      className={cn(
        "relative isolate overflow-hidden bg-red-600 text-white shadow-[0_30px_70px_-25px_rgba(220,38,38,0.65)] animate-in fade-in slide-in-from-top-2 duration-700",
        className,
      )}
    >
      {/* Subtle diagonal stripes, like a sale banner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.09] [background-image:repeating-linear-gradient(135deg,#fff_0_2px,transparent_2px_16px)]"
      />

      {offer.savePercent !== null && (
        <div
          aria-hidden="true"
          className="absolute right-3 top-3 grid size-[4.5rem] rotate-12 place-items-center rounded-full bg-white text-center font-display font-black uppercase leading-none text-red-600 shadow-lg sm:right-5 sm:top-5 sm:size-24 lg:left-[40%] lg:right-auto lg:top-1/2 lg:-translate-y-1/2"
        >
          <span>
            <span className="block text-[0.6rem] tracking-[0.15em] sm:text-xs">Save</span>
            <span className="block text-2xl sm:text-3xl">{offer.savePercent}%</span>
          </span>
        </div>
      )}

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
        <div className="pr-20 sm:pr-28 lg:pr-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-red-600">
              <Flame className="size-3.5" aria-hidden="true" /> Limited-time deal
            </span>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/90">
              {offer.newCustomersOnly ? "New customers only" : "While it lasts"}
            </span>
          </div>

          {offer.price ? (
            <p className="mt-3 font-display font-black uppercase leading-none">
              <span className="block text-sm tracking-[0.2em] text-white/90 sm:text-base">First week</span>
              <span className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-6xl tracking-tight sm:text-7xl">{offer.price}</span>
                <span className="pb-1.5 text-2xl sm:text-3xl">a meal</span>
                {offer.wasPerMeal && (
                  <span className="pb-2 text-lg font-bold normal-case text-white/75 sm:text-xl">
                    <span className="sr-only">instead of </span>
                    <span className="line-through decoration-2">{offer.wasPerMeal}</span>
                  </span>
                )}
              </span>
            </p>
          ) : (
            <p className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight">{offer.title}</p>
          )}
          {offer.example && <p className="mt-3 text-sm font-semibold text-white sm:text-base">{offer.example}</p>}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end lg:flex-col lg:items-stretch">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.2em]">
              <span className="relative flex size-2.5" aria-hidden="true">
                <span className="absolute inline-flex size-full rounded-full bg-white opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-white" />
              </span>
              {hurry ? "Hurry — less than 10 minutes left" : "Deal ends in"}
            </p>
            <div role="timer" aria-label={`${hours} hours ${minutes} minutes left`} className="flex gap-1.5">
              <Unit value={hours} label="hrs" />
              <Unit value={minutes} label="min" />
              <Unit value={seconds} label="sec" />
            </div>
          </div>
          <div className="sm:flex-1 lg:flex-none">
            <Link
              href="/order"
              data-track="select_promotion"
              data-track-promotion={offer.slug}
              className="group inline-flex h-14 w-full items-center justify-center gap-2 bg-white px-6 text-xs font-bold uppercase tracking-[0.16em] text-red-600 shadow-lg transition-colors hover:bg-mist"
            >
              {offer.ctaLabel}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <p className="mt-2 text-center text-[0.65rem] font-medium uppercase tracking-[0.16em] text-white/85">
              No payment online · we confirm with you
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
