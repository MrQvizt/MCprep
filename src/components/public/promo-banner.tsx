import { Countdown } from "@/components/shared/countdown";
import { MediaImage } from "@/components/shared/media-image";
import { formatPromoText } from "@/lib/promotions/format";
import type { PublicPromotion } from "@/lib/promotions";
import { cn } from "@/lib/utils";
import { CtaLink } from "./cta-link";

const THEME_ACCENT: Record<string, string> = {
  HALLOWEEN: "bg-[#ff6a13] text-ink",
  BLACK_FRIDAY: "bg-white text-ink",
  CHRISTMAS: "bg-[#c8102e] text-white",
  NEW_YEAR: "bg-[#d4af37] text-ink",
  VALENTINES: "bg-[#e0115f] text-white",
  SUMMER_FITNESS: "bg-[#ffd400] text-ink",
};

/**
 * High-impact promotion section with a real countdown to the stored end time.
 * Restrained seasonal accent only on the badge — the brand stays black & white.
 */
export function PromoBanner({
  promo,
  serverNow,
  ctaHref,
  className,
  headingLevel: H = "h2",
  preview = false,
}: {
  promo: PublicPromotion;
  serverNow: string;
  ctaHref?: string;
  className?: string;
  headingLevel?: "h1" | "h2";
  preview?: boolean;
}) {
  const ended = promo.state === "EXPIRED";
  const text = (s: string | null) => formatPromoText(s, { discountLabel: promo.discountLabel, endsAt: promo.endsAt });
  const href = ctaHref ?? `/plans?promo=${encodeURIComponent(promo.slug)}`;
  const accent = THEME_ACCENT[promo.theme] ?? "bg-white text-ink";

  return (
    <section
      aria-labelledby={`promo-${promo.id}`}
      className={cn("relative isolate overflow-hidden border-y border-white/10 bg-ink text-white", className)}
      data-promotion={promo.slug}
    >
      <div className="absolute inset-0 -z-10">
        {promo.imageUrl ? (
          <MediaImage media={{ url: promo.imageUrl, altText: promo.imageAlt }} alt="" className="absolute inset-0 opacity-35" sizes="100vw" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(70%_110%_at_100%_100%,#262626_0%,#080808_62%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/40" />
      </div>
      <div className="container-site grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:py-24">
        <div>
          {promo.badgeText && (
            <p className={cn("inline-block px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.2em]", accent)}>{text(promo.badgeText)}</p>
          )}
          <H id={`promo-${promo.id}`} className="mt-5 display-xl text-balance">
            {ended ? "This offer has ended" : text(promo.headline)}
          </H>
          {!ended && promo.subheadline && <p className="mt-4 display-sm text-white/80">{text(promo.subheadline)}</p>}
          {ended ? (
            promo.expiredMessage && <p className="mt-5 max-w-xl text-base text-fog">{promo.expiredMessage}</p>
          ) : (
            promo.description && <p className="mt-5 max-w-xl text-base leading-relaxed text-fog sm:text-lg">{text(promo.description)}</p>
          )}
          {!ended && promo.code && (
            <p className="mt-5 text-sm">
              Use code <span className="ml-1 border border-dashed border-white/50 px-2 py-1 font-mono font-bold tracking-widest">{promo.code}</span>
            </p>
          )}
          {!ended && (
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <CtaLink
                href={href}
                size="lg"
                data-promotion={promo.slug}
                data-track="select_promotion"
                data-track-promotion={promo.slug}
                tabIndex={preview ? -1 : undefined}
              >
                {text(promo.ctaText)}
              </CtaLink>
              {promo.audience === "NEW_CUSTOMERS" && (
                <p className="max-w-xs text-xs text-fog">New customers only. Eligibility is confirmed by our team before your price is final.</p>
              )}
            </div>
          )}
        </div>
        {!ended && promo.showCountdown && (
          <div className="lg:justify-self-end">
            <Countdown endsAt={promo.endsAt} serverNow={serverNow} refreshOnEnd={!preview} />
          </div>
        )}
      </div>
      {!ended && promo.terms && (
        <div className="container-site pb-8">
          <details className="text-xs text-fog">
            <summary className="cursor-pointer select-none underline-offset-4 hover:underline">Offer terms</summary>
            <p className="mt-2 max-w-3xl whitespace-pre-line">{promo.terms}</p>
          </details>
        </div>
      )}
    </section>
  );
}
