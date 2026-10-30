import Link from "next/link";
import { PromoCountdown } from "./promo-countdown";
import { formatPromoText } from "@/lib/promotions/format";
import type { PublicPromotion } from "@/lib/promotions";
import { cn } from "@/lib/utils";

/** Compact live-offer bar with a real countdown (used on plans/offers pages). */
export function PromoStrip({ promo, serverNow, className, href }: { promo: PublicPromotion; serverNow: string; className?: string; href?: string }) {
  const text = (s: string | null) => formatPromoText(s, { discountLabel: promo.discountLabel, endsAt: promo.endsAt });
  return (
    <div className={cn("light border border-ink/10 bg-paper text-ink", className)} data-promotion={promo.slug}>
      <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          {promo.badgeText && (
            <p className="mb-3 inline-block bg-ink px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white">{text(promo.badgeText)}</p>
          )}
          <p className="font-display text-2xl font-extrabold uppercase leading-tight sm:text-3xl">{text(promo.headline)}</p>
          {promo.description && <p className="mt-2 text-sm text-smoke">{text(promo.description)}</p>}
          {promo.code && (
            <p className="mt-3 text-sm">
              Use code <span className="ml-1 border border-dashed border-ink/40 px-2 py-0.5 font-mono font-bold tracking-widest">{promo.code}</span>
            </p>
          )}
          {promo.audience === "NEW_CUSTOMERS" && (
            <p className="mt-2 text-xs text-smoke">New customers only — eligibility is confirmed by our team before your price is final.</p>
          )}
          {href && (
            <Link
              href={href}
              data-track="select_promotion"
              data-track-promotion={promo.slug}
              className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.16em] underline underline-offset-8"
            >
              Offer details
            </Link>
          )}
        </div>
        {promo.showCountdown && (
          <PromoCountdown endsAt={promo.endsAt} personalWindowMinutes={promo.personalWindowMinutes} serverNow={serverNow} size="md" />
        )}
      </div>
    </div>
  );
}
