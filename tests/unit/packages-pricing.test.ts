import { describe, expect, it } from "vitest";
import { signOfferWindow, verifyOfferWindow } from "@/lib/offer-window";
import {
  evenSplit,
  findPackage,
  mealSelectionProblem,
  mealsPerWeek,
  packageLabel,
  perMealCents,
  selectionTotal,
} from "@/lib/packages";
import {
  calculateDiscount,
  computeQuote,
  discountLabel,
  effectiveEndsAt,
  firstWeekPriceCents,
  type PricingPromotion,
} from "@/lib/pricing";

const NOW = new Date("2026-10-30T10:00:00Z");
const MIN = 60_000;

const firstWeekOffer = (overrides: Partial<PricingPromotion> = {}): PricingPromotion => ({
  id: "intro",
  name: "First week €6 a meal",
  slug: "first-week-6-euro",
  headline: null,
  discountType: "FIRST_WEEK_MEAL_PRICE",
  discountValue: 600,
  maxDiscountCents: null,
  audience: "NEW_CUSTOMERS",
  requiresCode: false,
  code: null,
  appliesToAllPlans: true,
  planIds: [],
  startsAt: new Date(NOW.getTime() - 24 * 60 * MIN),
  endsAt: new Date(NOW.getTime() + 365 * 24 * 60 * MIN),
  isEnabled: true,
  priority: 10,
  totalRedemptionLimit: null,
  redemptionCount: 0,
  personalWindowMinutes: 120,
  ...overrides,
});

const weekly10 = { id: "ld5", priceCents: 9500, durationDays: 7, mealsPerWeek: 10 };
const weekly14 = { id: "ld7", priceCents: 11900, durationDays: 7, mealsPerWeek: 14 };
const lunch5 = { id: "l5", priceCents: 5250, durationDays: 7, mealsPerWeek: 5 };
const monthly10 = { id: "m10", priceCents: 36000, durationDays: 28, mealsPerWeek: 10 };
const monthly14 = { id: "m14", priceCents: 45000, durationDays: 28, mealsPerWeek: 14 };

describe("packages", () => {
  it("derives meals per week, labels and per-meal prices", () => {
    expect(mealsPerWeek({ mealsPerDay: 2, daysPerWeek: 5 })).toBe(10);
    expect(mealsPerWeek({ mealsPerDay: null, daysPerWeek: null })).toBeNull();
    expect(packageLabel({ mealsPerDay: 2, daysPerWeek: 7 })).toBe("Lunch + Dinner · 7 days");
    expect(packageLabel({ mealsPerDay: 1, daysPerWeek: 5 })).toBe("Lunch · 5 days");
    expect(perMealCents({ mealsPerDay: 2, daysPerWeek: 7, isSubscription: true, durationDays: 28, priceCents: 45000 })).toBe(804);
    expect(perMealCents({ mealsPerDay: 1, daysPerWeek: 5, isSubscription: false, durationDays: 7, priceCents: 5250 })).toBe(1050);
  });

  it("finds the package for a builder selection", () => {
    const list = [
      { slug: "a", mealsPerDay: 2, daysPerWeek: 5, isSubscription: false },
      { slug: "b", mealsPerDay: 2, daysPerWeek: 5, isSubscription: true },
    ];
    expect(findPackage(list, { mealsPerDay: 2, daysPerWeek: 5, isSubscription: true })?.slug).toBe("b");
    expect(findPackage(list, { mealsPerDay: 1, daysPerWeek: 5, isSubscription: true })).toBeUndefined();
  });

  it("splits meals evenly across dishes", () => {
    expect(evenSplit(["a", "b", "c", "d", "e"], 14).map((c) => c.quantity)).toEqual([3, 3, 3, 3, 2]);
    expect(selectionTotal(evenSplit(["a", "b", "c", "d", "e"], 7))).toBe(7);
    expect(evenSplit(["a", "b", "c", "d", "e"], 3)).toHaveLength(3);
  });

  it("validates dish choices against the package and the menu", () => {
    const menu = ["a", "b", "c"];
    expect(mealSelectionProblem([{ mealId: "a", quantity: 5 }, { mealId: "b", quantity: 5 }], 10, menu)).toBeNull();
    expect(mealSelectionProblem([], 10, menu)).toMatch(/Choose your 10 meals/);
    expect(mealSelectionProblem([{ mealId: "a", quantity: 4 }], 5, menu)).toMatch(/Add 1 more meal /);
    expect(mealSelectionProblem([{ mealId: "a", quantity: 7 }], 5, menu)).toMatch(/Remove 2 meals/);
    expect(mealSelectionProblem([{ mealId: "zzz", quantity: 5 }], 5, menu)).toMatch(/no longer on the menu/);
    expect(mealSelectionProblem([{ mealId: "a", quantity: 2 }, { mealId: "a", quantity: 3 }], 5, menu)).toMatch(/only be listed once/);
    expect(mealSelectionProblem([{ mealId: "a", quantity: 2.5 }, { mealId: "b", quantity: 2.5 }], 5, menu)).toMatch(/whole numbers/);
  });
});

describe("first week at a price per meal", () => {
  it("prices the first week at €6 a meal for weekly packages", () => {
    const offer = firstWeekOffer();
    expect(calculateDiscount(9500, offer, weekly10)).toBe(3500); // €95 → €60
    expect(calculateDiscount(11900, offer, weekly14)).toBe(3500); // €119 → €84
    expect(calculateDiscount(5250, offer, lunch5)).toBe(2250); // €52.50 → €30
  });

  it("discounts only the first week of a monthly subscription", () => {
    expect(firstWeekPriceCents(monthly10)).toBe(9000);
    expect(firstWeekPriceCents(monthly14)).toBe(11250);
    const offer = firstWeekOffer();
    expect(calculateDiscount(36000, offer, monthly10)).toBe(3000); // first month €330, then €360
    expect(calculateDiscount(45000, offer, monthly14)).toBe(2850); // first month €421.50, then €450
  });

  it("gives no discount to plans that aren't packages", () => {
    expect(calculateDiscount(12000, firstWeekOffer(), { durationDays: 14, mealsPerWeek: null })).toBe(0);
    expect(calculateDiscount(12000, firstWeekOffer())).toBe(0);
  });

  it("never discounts below zero when the package is already cheaper", () => {
    expect(calculateDiscount(500, firstWeekOffer(), { durationDays: 7, mealsPerWeek: 5 })).toBe(0);
  });

  it("labels the offer", () => {
    expect(discountLabel(firstWeekOffer())).toBe("First week €6/meal");
  });
});

describe("personal 2-hour window", () => {
  it("applies only while the visitor's window is open", () => {
    const promotions = [firstWeekOffer()];
    const started = new Date(NOW.getTime() - 30 * MIN);
    const open = computeQuote({ plan: weekly10, promotions, now: NOW, firstOrderDeclared: true, offerWindowStartedAt: started });
    expect(open.totalCents).toBe(6000);
    expect(open.requiresVerification).toBe(true);
    expect(open.promotion?.endsAt.toISOString()).toBe(new Date(started.getTime() + 120 * MIN).toISOString());

    const expired = computeQuote({
      plan: weekly10,
      promotions,
      now: NOW,
      firstOrderDeclared: true,
      offerWindowStartedAt: new Date(NOW.getTime() - 121 * MIN),
    });
    expect(expired.totalCents).toBe(9500);
    expect(expired.promotion).toBeNull();
  });

  it("doesn't apply when the window never started", () => {
    const q = computeQuote({ plan: weekly10, promotions: [firstWeekOffer()], now: NOW, firstOrderDeclared: true, offerWindowStartedAt: null });
    expect(q.totalCents).toBe(9500);
  });

  it("offers the first-order prompt with the personal deadline before the declaration", () => {
    const started = new Date(NOW.getTime() - 10 * MIN);
    const q = computeQuote({ plan: weekly14, promotions: [firstWeekOffer()], now: NOW, offerWindowStartedAt: started });
    expect(q.totalCents).toBe(11900);
    expect(q.availableFirstOrderOffer).toMatchObject({ discountCents: 3500 });
    expect(q.availableFirstOrderOffer?.endsAt.getTime()).toBe(started.getTime() + 120 * MIN);
  });

  it("never runs past the campaign end", () => {
    const end = new Date(NOW.getTime() + 15 * MIN);
    expect(effectiveEndsAt(firstWeekOffer({ endsAt: end }), new Date(NOW.getTime() - 10 * MIN))?.getTime()).toBe(end.getTime());
    expect(effectiveEndsAt(firstWeekOffer({ personalWindowMinutes: null }), null)?.getTime()).toBe(firstWeekOffer().endsAt.getTime());
    expect(effectiveEndsAt(firstWeekOffer(), null)).toBeNull();
  });

  it("signs the window start so it can't be moved or forged", () => {
    const secret = "test-secret";
    const value = signOfferWindow(NOW.getTime() - 5 * MIN, secret);
    expect(verifyOfferWindow(value, secret, NOW)?.getTime()).toBe(NOW.getTime() - 5 * MIN);
    // Tampered start time
    const [v, , sig] = value.split(".");
    expect(verifyOfferWindow(`${v}.${NOW.getTime()}.${sig}`, secret, NOW)).toBeNull();
    // Wrong secret, garbage, future start
    expect(verifyOfferWindow(value, "other", NOW)).toBeNull();
    expect(verifyOfferWindow("nonsense", secret, NOW)).toBeNull();
    expect(verifyOfferWindow(signOfferWindow(NOW.getTime() + 3_600_000, secret), secret, NOW)).toBeNull();
  });
});
