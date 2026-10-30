import { Check } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { MEALS_PER_DAY_LABELS, weeksInPeriod } from "@/lib/packages";
import type { PublicPlan } from "@/lib/public-data";
import { cn } from "@/lib/utils";
import { CtaLink } from "./cta-link";
import { PackageOfferLine } from "./package-offer-line";

const money = (cents: number, currency: string) => formatMoney(cents, currency, { hideZeroDecimals: true });

function orderHref(plan: PublicPlan, extra?: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams({ plan: plan.slug });
  for (const [k, v] of Object.entries(extra ?? {})) if (v) sp.set(k, v);
  return `/order?${sp.toString()}`;
}

/** A "build your package" option: per-meal price first, then the weekly/monthly price and any first-week offer. */
export function PackageCard({
  plan,
  currency = "EUR",
  orderParams,
  className,
  headingLevel: H = "h3",
}: {
  plan: PublicPlan;
  currency?: string;
  orderParams?: Record<string, string | null | undefined>;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const featured = plan.isRecommended;
  const weeks = weeksInPeriod(plan);
  const offer = plan.offer;
  const meals = MEALS_PER_DAY_LABELS[plan.mealsPerDay ?? 1] ?? "Meals";
  return (
    <article
      aria-label={plan.name}
      className={cn(
        "relative flex h-full flex-col border p-6 transition-transform duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 sm:p-7",
        featured ? "light border-white bg-paper text-ink" : "border-white/15 bg-charcoal text-white",
        className,
      )}
    >
      {(featured || plan.tagline) && (
        <p
          className={cn(
            "absolute -top-3 left-6 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.2em]",
            featured ? "bg-ink text-white" : "bg-white text-ink",
          )}
        >
          {featured ? "Most popular" : plan.tagline}
        </p>
      )}
      <header>
        <H className="font-display text-xl font-black uppercase leading-tight">
          {meals}
          <span className="block text-current/60">{plan.daysPerWeek} days a week</span>
        </H>
        <p className="mt-2 text-sm text-current/70">
          {plan.mealsPerWeek} meals a week{plan.isSubscription ? ` · ${weeks * (plan.mealsPerWeek ?? 0)} every ${weeks} weeks` : ""}
        </p>
      </header>

      <div className="mt-6">
        {plan.perMealCents !== null ? (
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-5xl font-black tabular leading-none">{money(plan.perMealCents, currency)}</span>
            <span className="text-sm text-current/60">/ meal</span>
          </p>
        ) : (
          <p className="font-display text-2xl font-black">Price confirmed with you</p>
        )}
        {plan.priceCents !== null && (
          <p className="mt-2 text-sm font-semibold tabular">
            {money(plan.priceCents, currency)} {plan.isSubscription ? `every ${weeks} weeks` : "a week"}
          </p>
        )}
        {plan.savingsLabel && (
          <p className={cn("mt-3 inline-block px-2 py-1 text-xs font-semibold", featured ? "bg-mist" : "bg-white/10")}>{plan.savingsLabel}</p>
        )}
      </div>

      {offer && plan.priceCents !== null && (
        <PackageOfferLine
          lead={plan.isSubscription ? `First ${weeks} weeks` : "First week"}
          price={money(offer.priceCents, currency)}
          was={money(plan.priceCents, currency)}
          audience={offer.firstOrderOnly ? "New customers" : "Limited time"}
          personal={
            offer.personal && offer.windowMinutes
              ? { windowMinutes: offer.windowMinutes, startedAt: offer.windowStartedAt, endsAt: offer.endsAt, serverNow: offer.serverNow }
              : null
          }
          featured={featured}
        />
      )}

      <ul className="mt-5 space-y-2 text-sm">
        {plan.features.slice(0, 3).map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-7">
        <CtaLink
          href={orderHref(plan, orderParams)}
          variant={featured ? "dark" : "primary"}
          className="w-full"
          data-plan={plan.slug}
          data-track="select_plan"
          data-track-plan={plan.slug}
          aria-label={`Choose ${plan.name}`}
        >
          Choose your dishes
        </CtaLink>
      </div>
    </article>
  );
}

/** Weekly packages, then monthly subscriptions. */
export function PackagesShowcase({
  plans,
  currency,
  orderParams,
  className,
}: {
  plans: PublicPlan[];
  currency: string;
  orderParams?: Record<string, string | null | undefined>;
  className?: string;
}) {
  const weekly = plans.filter((p) => !p.isSubscription);
  const monthly = plans.filter((p) => p.isSubscription);
  return (
    <div className={cn("space-y-14", className)}>
      {weekly.length > 0 && (
        <div>
          <p className="eyebrow mb-6 text-fog">Weekly · pay as you go</p>
          <ul className={cn("grid gap-5 pt-3", weekly.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3")}>
            {weekly.map((p) => (
              <li key={p.id}>
                <PackageCard plan={p} currency={currency} orderParams={orderParams} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {monthly.length > 0 && (
        <div>
          <p className="eyebrow mb-6 text-fog">Monthly subscription · subscribe &amp; save</p>
          <ul className="grid gap-5 pt-3 sm:grid-cols-2">
            {monthly.map((p) => (
              <li key={p.id}>
                <PackageCard plan={p} currency={currency} orderParams={orderParams} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
