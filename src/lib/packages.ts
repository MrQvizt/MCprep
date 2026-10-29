/**
 * "Build your package" helpers — client-safe, no database access.
 *
 * A package is a plan with meals per day (1 = lunch, 2 = lunch + dinner),
 * days per week (5 or 7) and a billing period (one week, or a monthly
 * subscription of 28 days). Customers then choose how many of each dish on
 * the current menu they'd like per week; the choices must add up to the
 * package's meals per week.
 */

export interface PackageShape {
  mealsPerDay: number | null;
  daysPerWeek: number | null;
  isSubscription: boolean;
  durationDays: number;
  priceCents: number | null;
}

export interface MealChoice {
  mealId: string;
  quantity: number;
}

export function isPackage(p: Pick<PackageShape, "mealsPerDay" | "daysPerWeek">): boolean {
  return Boolean(p.mealsPerDay && p.daysPerWeek && p.mealsPerDay > 0 && p.daysPerWeek > 0);
}

export function mealsPerWeek(p: Pick<PackageShape, "mealsPerDay" | "daysPerWeek">): number | null {
  return isPackage(p) ? p.mealsPerDay! * p.daysPerWeek! : null;
}

export function weeksInPeriod(p: Pick<PackageShape, "durationDays">): number {
  return Math.max(1, Math.round(p.durationDays / 7));
}

/** Price per meal across the whole billing period, in cents (rounded). */
export function perMealCents(p: PackageShape): number | null {
  const perWeek = mealsPerWeek(p);
  if (p.priceCents === null || !perWeek) return null;
  return Math.round(p.priceCents / (perWeek * weeksInPeriod(p)));
}

export const MEALS_PER_DAY_LABELS: Record<number, string> = { 1: "Lunch", 2: "Lunch + Dinner" };

/** "Lunch + Dinner · 5 days" */
export function packageLabel(p: Pick<PackageShape, "mealsPerDay" | "daysPerWeek">): string {
  if (!isPackage(p)) return "";
  return `${MEALS_PER_DAY_LABELS[p.mealsPerDay!] ?? `${p.mealsPerDay} meals a day`} · ${p.daysPerWeek} days`;
}

export function billingLabel(p: Pick<PackageShape, "isSubscription" | "durationDays">): string {
  return p.isSubscription ? `Monthly · every ${weeksInPeriod(p)} weeks` : "Weekly";
}

export interface PackageKey {
  mealsPerDay: number;
  daysPerWeek: number;
  isSubscription: boolean;
}

export function findPackage<T extends Pick<PackageShape, "mealsPerDay" | "daysPerWeek" | "isSubscription">>(
  packages: T[],
  key: PackageKey,
): T | undefined {
  return packages.find(
    (p) => p.mealsPerDay === key.mealsPerDay && p.daysPerWeek === key.daysPerWeek && p.isSubscription === key.isSubscription,
  );
}

/** Spread `total` meals as evenly as possible over the dishes (earlier dishes get the remainder). */
export function evenSplit(mealIds: string[], total: number): MealChoice[] {
  if (mealIds.length === 0 || total <= 0) return [];
  const base = Math.floor(total / mealIds.length);
  const extra = total % mealIds.length;
  return mealIds
    .map((mealId, i) => ({ mealId, quantity: base + (i < extra ? 1 : 0) }))
    .filter((c) => c.quantity > 0);
}

export function selectionTotal(choices: MealChoice[]): number {
  return choices.reduce((sum, c) => sum + (Number.isFinite(c.quantity) ? c.quantity : 0), 0);
}

/**
 * Validate dish choices against the package and the dishes on the menu.
 * Returns an error message, or null when the selection is valid.
 */
export function mealSelectionProblem(choices: MealChoice[], perWeek: number, availableMealIds: string[]): string | null {
  const positive = choices.filter((c) => c.quantity > 0);
  if (positive.length === 0) return `Choose your ${perWeek} meals for the week.`;
  const ids = new Set<string>();
  for (const c of positive) {
    if (!Number.isInteger(c.quantity) || c.quantity < 1) return "Meal quantities must be whole numbers.";
    if (!availableMealIds.includes(c.mealId)) return "One of your dishes is no longer on the menu. Please choose again.";
    if (ids.has(c.mealId)) return "Each dish can only be listed once.";
    ids.add(c.mealId);
  }
  const total = selectionTotal(positive);
  if (total < perWeek) return `Add ${perWeek - total} more meal${perWeek - total === 1 ? "" : "s"} — your package has ${perWeek} a week.`;
  if (total > perWeek) return `Remove ${total - perWeek} meal${total - perWeek === 1 ? "" : "s"} — your package has ${perWeek} a week.`;
  return null;
}
