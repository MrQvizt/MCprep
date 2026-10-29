import { describe, expect, it } from "vitest";
import { calculateDiscount, computeQuote, discountLabel, promotionState, type PricingPromotion } from "@/lib/pricing";

const NOW = new Date("2026-10-29T12:00:00Z");
const HOUR = 3_600_000;

function promo(overrides: Partial<PricingPromotion> = {}): PricingPromotion {
  return {
    id: overrides.id ?? "p1",
    name: "Promo",
    slug: overrides.slug ?? "promo",
    headline: null,
    discountType: "PERCENTAGE",
    discountValue: 2000,
    maxDiscountCents: null,
    audience: "ALL_CUSTOMERS",
    requiresCode: false,
    code: null,
    appliesToAllPlans: true,
    planIds: [],
    startsAt: new Date(NOW.getTime() - HOUR),
    endsAt: new Date(NOW.getTime() + 72 * HOUR),
    isEnabled: true,
    priority: 0,
    totalRedemptionLimit: null,
    redemptionCount: 0,
    ...overrides,
  };
}

const plan = { id: "plan-2w", priceCents: 12000 };

describe("calculateDiscount", () => {
  it("calculates percentage discounts in integer cents", () => {
    expect(calculateDiscount(12000, { discountType: "PERCENTAGE", discountValue: 2000, maxDiscountCents: null })).toBe(2400);
    expect(calculateDiscount(12000, { discountType: "PERCENTAGE", discountValue: 2500, maxDiscountCents: null })).toBe(3000);
  });

  it("rounds half-up to the nearest cent", () => {
    // 39.99 × 15% = 5.9985 → €6.00
    expect(calculateDiscount(3999, { discountType: "PERCENTAGE", discountValue: 1500, maxDiscountCents: null })).toBe(600);
    // 0.01 × 50% = 0.005 → €0.01 (half-up)
    expect(calculateDiscount(1, { discountType: "PERCENTAGE", discountValue: 5000, maxDiscountCents: null })).toBe(1);
    // 12.5% of €99.99 = 12.49875 → €12.50
    expect(calculateDiscount(9999, { discountType: "PERCENTAGE", discountValue: 1250, maxDiscountCents: null })).toBe(1250);
  });

  it("calculates fixed-amount discounts and never exceeds the price", () => {
    expect(calculateDiscount(12000, { discountType: "FIXED_AMOUNT", discountValue: 1500, maxDiscountCents: null })).toBe(1500);
    expect(calculateDiscount(1000, { discountType: "FIXED_AMOUNT", discountValue: 1500, maxDiscountCents: null })).toBe(1000);
  });

  it("applies the maximum discount cap", () => {
    expect(calculateDiscount(50000, { discountType: "PERCENTAGE", discountValue: 2000, maxDiscountCents: 5000 })).toBe(5000);
  });

  it("returns 0 for invalid base prices", () => {
    expect(calculateDiscount(0, { discountType: "PERCENTAGE", discountValue: 2000, maxDiscountCents: null })).toBe(0);
    expect(calculateDiscount(-5, { discountType: "FIXED_AMOUNT", discountValue: 100, maxDiscountCents: null })).toBe(0);
  });
});

describe("promotionState", () => {
  it("reports scheduled, active, expired, draft and limit states", () => {
    expect(promotionState(promo({ startsAt: new Date(NOW.getTime() + HOUR) }), NOW)).toBe("SCHEDULED");
    expect(promotionState(promo(), NOW)).toBe("ACTIVE");
    expect(promotionState(promo({ endsAt: NOW }), NOW)).toBe("EXPIRED"); // end is exclusive
    expect(promotionState(promo({ isEnabled: false }), NOW)).toBe("DRAFT");
    expect(promotionState(promo({ totalRedemptionLimit: 5, redemptionCount: 5 }), NOW)).toBe("LIMIT_REACHED");
  });
});

describe("computeQuote", () => {
  it("returns the base price when no promotions apply", () => {
    const q = computeQuote({ plan, promotions: [], now: NOW });
    expect(q).toMatchObject({ basePriceCents: 12000, discountCents: 0, totalCents: 12000, promotion: null });
  });

  it("applies an active automatic promotion", () => {
    const q = computeQuote({ plan, promotions: [promo()], now: NOW });
    expect(q.discountCents).toBe(2400);
    expect(q.totalCents).toBe(9600);
    expect(q.promotion?.id).toBe("p1");
    expect(q.requiresVerification).toBe(false);
  });

  it("stops applying a promotion once it has expired", () => {
    const expired = promo({ endsAt: new Date(NOW.getTime() - 1) });
    const q = computeQuote({ plan, promotions: [expired], now: NOW });
    expect(q.discountCents).toBe(0);
    expect(q.totalCents).toBe(12000);
  });

  it("does not apply scheduled or disabled promotions", () => {
    const q1 = computeQuote({ plan, promotions: [promo({ startsAt: new Date(NOW.getTime() + HOUR) })], now: NOW });
    const q2 = computeQuote({ plan, promotions: [promo({ isEnabled: false })], now: NOW });
    expect(q1.discountCents).toBe(0);
    expect(q2.discountCents).toBe(0);
  });

  it("respects eligible plans", () => {
    const limited = promo({ appliesToAllPlans: false, planIds: ["plan-1m"] });
    expect(computeQuote({ plan, promotions: [limited], now: NOW }).discountCents).toBe(0);
    expect(computeQuote({ plan: { id: "plan-1m", priceCents: 22000 }, promotions: [limited], now: NOW }).discountCents).toBe(4400);
  });

  it("never stacks promotions — the single best discount wins", () => {
    const a = promo({ id: "a", slug: "a", discountValue: 1000 });
    const b = promo({ id: "b", slug: "b", discountType: "FIXED_AMOUNT", discountValue: 3000 });
    const q = computeQuote({ plan, promotions: [a, b], now: NOW });
    expect(q.promotion?.id).toBe("b");
    expect(q.discountCents).toBe(3000);
  });

  it("requires the first-order declaration for new-customer promotions and marks them for verification", () => {
    const newCustomer = promo({ audience: "NEW_CUSTOMERS" });
    const without = computeQuote({ plan, promotions: [newCustomer], now: NOW, firstOrderDeclared: false });
    expect(without.discountCents).toBe(0);
    expect(without.availableFirstOrderOffer?.discountCents).toBe(2400);

    const withDecl = computeQuote({ plan, promotions: [newCustomer], now: NOW, firstOrderDeclared: true });
    expect(withDecl.discountCents).toBe(2400);
    expect(withDecl.requiresVerification).toBe(true);
    expect(withDecl.availableFirstOrderOffer).toBeNull();
  });

  it("validates coupon codes (case-insensitive) and explains failures", () => {
    const coupon = promo({ id: "c", requiresCode: true, code: "FUEL10", discountValue: 1000 });
    expect(computeQuote({ plan, promotions: [coupon], now: NOW, couponCode: " fuel10 " }).couponStatus).toBe("APPLIED");
    expect(computeQuote({ plan, promotions: [coupon], now: NOW }).discountCents).toBe(0); // code required
    expect(computeQuote({ plan, promotions: [coupon], now: NOW, couponCode: "NOPE" }).couponStatus).toBe("INVALID");
    const expired = promo({ id: "c", requiresCode: true, code: "OLD", endsAt: new Date(NOW.getTime() - 1) });
    expect(computeQuote({ plan, promotions: [expired], now: NOW, couponCode: "old" }).couponStatus).toBe("EXPIRED");
    const otherPlan = promo({ id: "c", requiresCode: true, code: "PLAN", appliesToAllPlans: false, planIds: ["x"] });
    expect(computeQuote({ plan, promotions: [otherPlan], now: NOW, couponCode: "plan" }).couponStatus).toBe("NOT_ELIGIBLE_PLAN");
  });

  it("reports NOT_BETTER when an automatic offer beats the coupon (no stacking)", () => {
    const auto = promo({ id: "auto", discountValue: 2500 });
    const coupon = promo({ id: "c", slug: "c", requiresCode: true, code: "SMALL", discountValue: 500 });
    const q = computeQuote({ plan, promotions: [auto, coupon], now: NOW, couponCode: "small" });
    expect(q.promotion?.id).toBe("auto");
    expect(q.couponStatus).toBe("NOT_BETTER");
    expect(q.discountCents).toBe(3000);
  });

  it("stops applying when the total redemption limit is reached", () => {
    const limited = promo({ totalRedemptionLimit: 10, redemptionCount: 10 });
    expect(computeQuote({ plan, promotions: [limited], now: NOW }).discountCents).toBe(0);
  });

  it("adds delivery fees without discounting them", () => {
    const q = computeQuote({ plan, promotions: [promo()], now: NOW, deliveryFeeCents: 500 });
    expect(q.totalCents).toBe(12000 - 2400 + 500);
  });

  it("handles price-on-request plans", () => {
    const q = computeQuote({ plan: { id: "x", priceCents: null }, promotions: [promo()], now: NOW });
    expect(q.totalCents).toBeNull();
    expect(q.discountCents).toBe(0);
  });

  it("never applies selected-customer promotions automatically", () => {
    const selected = promo({ audience: "SELECTED_CUSTOMERS" });
    expect(computeQuote({ plan, promotions: [selected], now: NOW, firstOrderDeclared: true }).discountCents).toBe(0);
  });
});

describe("discountLabel", () => {
  it("formats percentage and fixed discounts", () => {
    expect(discountLabel({ discountType: "PERCENTAGE", discountValue: 2000 })).toBe("20% off");
    expect(discountLabel({ discountType: "PERCENTAGE", discountValue: 1250 })).toBe("12.5% off");
    expect(discountLabel({ discountType: "FIXED_AMOUNT", discountValue: 1000 })).toMatch(/10 off$/);
  });
});
