import { Check } from "lucide-react";
import type { PublicPlan } from "@/lib/public-data";
import { cn } from "@/lib/utils";
import { CtaLink } from "./cta-link";
import { Price } from "./price";

function orderLink(plan: string, promo: string | null, extra?: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams({ plan });
  if (promo) sp.set("promo", promo);
  for (const [k, v] of Object.entries(extra ?? {})) if (v) sp.set(k, v);
  return `/order?${sp.toString()}`;
}

/**
 * Pricing card. Prices always come from the database (never hard-coded); an
 * active promotion shows the original price struck through. First-order
 * offers are clearly labelled as subject to verification.
 */
export function PlanCard({
  plan,
  currency = "EUR",
  className,
  orderParams,
  headingLevel: H = "h3",
}: {
  plan: PublicPlan;
  currency?: string;
  className?: string;
  /** Extra query parameters for the order link (e.g. utm_campaign from a landing page). */
  orderParams?: Record<string, string | null | undefined>;
  headingLevel?: "h2" | "h3";
}) {
  const featured = plan.isRecommended;
  const offer = plan.offer;
  const perWeek = plan.priceCents !== null && plan.durationDays >= 7 ? Math.round((offer?.priceCents ?? plan.priceCents) / (plan.durationDays / 7)) : null;
  return (
    <article
      className={cn(
        "relative flex h-full flex-col border p-7 transition-transform duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 sm:p-8",
        featured ? "light border-white bg-paper text-ink" : "border-white/15 bg-charcoal text-white",
        className,
      )}
      aria-label={`${plan.name} plan`}
    >
      {featured && (
        <p className="absolute -top-3 left-7 bg-ink px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white">
          Recommended
        </p>
      )}
      <header>
        {plan.tagline && <p className="eyebrow text-current/60">{plan.tagline}</p>}
        <H className="mt-2 display-md">{plan.name}</H>
        {plan.description && <p className="mt-3 text-sm leading-relaxed text-current/70">{plan.description}</p>}
      </header>

      <div className="mt-7">
        {offer ? (
          <>
            <p className="mb-2 inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em]">
              <span className={cn("px-2 py-0.5", featured ? "bg-ink text-white" : "bg-white text-ink")}>{offer.name}</span>
            </p>
            <Price cents={offer.priceCents} originalCents={plan.priceCents} currency={currency} />
            <p className="mt-2 text-xs text-current/60">
              {offer.firstOrderOnly ? "First-order price for new customers — verified by our team." : "Limited-time offer price."}
            </p>
          </>
        ) : (
          <Price cents={plan.priceCents} currency={currency} onRequestLabel="Price confirmed with you" />
        )}
        {perWeek !== null && plan.durationDays > 7 && (
          <p className="mt-2 text-xs text-current/60 tabular">
            ≈ {new Intl.NumberFormat("en-MT", { style: "currency", currency, maximumFractionDigits: 0 }).format(perWeek / 100)} per week
          </p>
        )}
        {plan.savingsLabel && (
          <p className={cn("mt-3 inline-block px-2 py-1 text-xs font-semibold", featured ? "bg-mist" : "bg-white/10")}>{plan.savingsLabel}</p>
        )}
      </div>

      {(plan.features.length > 0 || plan.mealsIncluded) && (
        <ul className="mt-7 space-y-2.5 border-t border-current/15 pt-6 text-sm">
          {plan.mealsIncluded && (
            <li className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{plan.mealsIncluded} meals included</span>
            </li>
          )}
          {plan.features.map((f) => (
            <li key={f} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-8">
        <CtaLink
          href={orderLink(plan.slug, offer?.promotionSlug ?? null, orderParams)}
          variant={featured ? "dark" : "primary"}
          className="w-full"
          data-plan={plan.slug}
          data-track="select_plan"
          data-track-plan={plan.slug}
          data-track-promotion={offer?.promotionSlug}
          aria-label={`Choose the ${plan.name} plan`}
        >
          Choose this plan
        </CtaLink>
      </div>
    </article>
  );
}
