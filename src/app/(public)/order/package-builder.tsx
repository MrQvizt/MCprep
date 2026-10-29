"use client";

import { Check } from "lucide-react";
import { findPackage, MEALS_PER_DAY_LABELS } from "@/lib/packages";
import { cn } from "@/lib/utils";

export interface PackageOption {
  slug: string;
  name: string;
  mealsPerDay: number | null;
  daysPerWeek: number | null;
  isSubscription: boolean;
  durationDays: number;
  priceCents: number | null;
  mealsPerWeek: number | null;
  perMealCents: number | null;
  isRecommended: boolean;
  savingsLabel: string | null;
}

interface Choice<T> {
  value: T;
  title: string;
  note?: string;
  badge?: string | null;
  disabled?: boolean;
  disabledNote?: string;
}

function Segmented<T extends string | number | boolean>({
  name,
  legend,
  choices,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  choices: Choice<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/80">{legend}</legend>
      <div className={cn("grid gap-3", choices.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
        {choices.map((c) => {
          const checked = c.value === value;
          return (
            <label
              key={String(c.value)}
              className={cn(
                "relative flex min-h-[5.5rem] cursor-pointer flex-col justify-between border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white",
                checked ? "border-white bg-white text-ink" : "border-white/20 hover:border-white/60",
                c.disabled && "cursor-not-allowed opacity-40 hover:border-white/20",
              )}
            >
              <input
                type="radio"
                name={name}
                checked={checked}
                disabled={c.disabled}
                onChange={() => onChange(c.value)}
                className="sr-only"
              />
              <span className="flex items-start justify-between gap-2">
                <span className="font-display text-base font-black uppercase leading-tight sm:text-lg">{c.title}</span>
                {checked && <Check className="size-4 shrink-0" aria-hidden="true" />}
              </span>
              <span className={cn("mt-2 text-xs leading-snug", checked ? "text-ink/70" : "text-fog")}>
                {c.disabled ? c.disabledNote : c.note}
              </span>
              {c.badge && !c.disabled && (
                <span
                  className={cn(
                    "absolute -top-2.5 right-3 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em]",
                    checked ? "bg-ink text-white" : "bg-white text-ink",
                  )}
                >
                  {c.badge}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Three choices — meals per day, days per week, weekly or monthly — that map
 * to one package (plan). Combinations without a package are disabled.
 */
export function PackageBuilder({
  packages,
  selectedSlug,
  onSelect,
  money,
}: {
  packages: PackageOption[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
  money: (cents: number) => string;
}) {
  const selected = packages.find((p) => p.slug === selectedSlug) ?? packages[0];
  const mealsPerDay = selected.mealsPerDay ?? 1;
  const daysPerWeek = selected.daysPerWeek ?? 5;
  const isSubscription = selected.isSubscription;

  const mealsOptions = [...new Set(packages.map((p) => p.mealsPerDay!))].sort();
  const dayOptions = [...new Set(packages.map((p) => p.daysPerWeek!))].sort();

  /** Select the closest existing package after one choice changes. */
  const choose = (next: { mealsPerDay?: number; daysPerWeek?: number; isSubscription?: boolean }) => {
    const key = { mealsPerDay, daysPerWeek, isSubscription, ...next };
    const exact = findPackage(packages, key);
    const fallback =
      findPackage(packages, { ...key, isSubscription: false }) ??
      packages.find((p) => p.mealsPerDay === key.mealsPerDay && p.daysPerWeek === key.daysPerWeek) ??
      packages.find((p) => p.mealsPerDay === key.mealsPerDay);
    const target = exact ?? fallback;
    if (target) onSelect(target.slug);
  };

  const cheapestPerMeal = (filter: (p: PackageOption) => boolean) => {
    const values = packages.filter(filter).map((p) => p.perMealCents).filter((v): v is number => v !== null);
    return values.length ? Math.min(...values) : null;
  };
  const fromLabel = (cents: number | null) => (cents !== null ? `from ${money(cents)} a meal` : undefined);

  const monthlyHere = findPackage(packages, { mealsPerDay, daysPerWeek, isSubscription: true });
  const weeklyHere = findPackage(packages, { mealsPerDay, daysPerWeek, isSubscription: false });
  const monthlyAnywhere = packages.some((p) => p.isSubscription);
  const monthlyFor = packages.filter((p) => p.isSubscription).map((p) => MEALS_PER_DAY_LABELS[p.mealsPerDay!])[0];

  return (
    <div className="space-y-7">
      <Segmented
        name="mealsPerDay"
        legend="Meals per day"
        value={mealsPerDay}
        onChange={(v) => choose({ mealsPerDay: v })}
        choices={mealsOptions.map((m) => ({
          value: m,
          title: MEALS_PER_DAY_LABELS[m] ?? `${m} meals a day`,
          note: fromLabel(cheapestPerMeal((p) => p.mealsPerDay === m && !p.isSubscription)),
          badge: packages.some((p) => p.mealsPerDay === m && p.isRecommended) ? "Most popular" : null,
        }))}
      />
      <Segmented
        name="daysPerWeek"
        legend="Days per week"
        value={daysPerWeek}
        onChange={(v) => choose({ daysPerWeek: v })}
        choices={dayOptions.map((d) => ({
          value: d,
          title: `${d} days`,
          note: d === 5 ? "Monday to Friday" : d === 7 ? "Every day of the week" : undefined,
        }))}
      />
      {monthlyAnywhere && (
        <Segmented
          name="billing"
          legend="How often"
          value={isSubscription}
          onChange={(v) => choose({ isSubscription: v })}
          choices={[
            {
              value: false,
              title: "Weekly",
              note: weeklyHere?.priceCents != null ? `${money(weeklyHere.priceCents)} a week` : "One week at a time",
              disabled: !weeklyHere,
              disabledNote: "Not available for this choice",
            },
            {
              value: true,
              title: "Monthly",
              note: monthlyHere
                ? `${monthlyHere.priceCents != null ? `${money(monthlyHere.priceCents)} every 4 weeks` : "Subscription"}${
                    monthlyHere.savingsLabel ? ` · ${monthlyHere.savingsLabel}` : ""
                  }`
                : undefined,
              badge: monthlyHere ? "Best value" : null,
              disabled: !monthlyHere,
              disabledNote: monthlyFor ? `Monthly subscriptions are for ${monthlyFor}` : "Not available for this choice",
            },
          ]}
        />
      )}
    </div>
  );
}
