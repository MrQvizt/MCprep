/**
 * Pure pricing engine — no database access, fully unit-tested.
 *
 * Rules
 * - Money is integer cents. Percentages are basis points (2000 = 20%).
 * - At most ONE promotion applies to an order (no stacking). When several are
 *   valid (automatic + coupon) the largest discount wins; ties go to the
 *   higher priority, then the one ending soonest.
 * - Promotions apply only between startsAt (inclusive) and endsAt (exclusive),
 *   only when enabled, only to eligible plans, and only while the optional
 *   total redemption limit has not been reached.
 * - New-customer promotions require the customer's first-order declaration and
 *   are always "subject to verification" — the quote never depends on the
 *   customer's identity, so it cannot leak whether an email/phone is known.
 * - The discount never exceeds the plan price; delivery fees are not discounted.
 */

export type DiscountTypeValue = "PERCENTAGE" | "FIXED_AMOUNT";
export type AudienceValue = "ALL_CUSTOMERS" | "NEW_CUSTOMERS" | "SELECTED_CUSTOMERS";

export interface PricingPromotion {
  id: string;
  name: string;
  slug: string;
  headline?: string | null;
  discountType: DiscountTypeValue;
  discountValue: number;
  maxDiscountCents: number | null;
  audience: AudienceValue;
  requiresCode: boolean;
  code: string | null;
  appliesToAllPlans: boolean;
  planIds: string[];
  startsAt: Date;
  endsAt: Date;
  isEnabled: boolean;
  priority: number;
  totalRedemptionLimit: number | null;
  /** Redemptions counted towards the total limit (requested + approved). */
  redemptionCount: number;
}

export interface PricingPlan {
  id: string;
  priceCents: number | null;
}

export type PromotionState = "DRAFT" | "SCHEDULED" | "ACTIVE" | "EXPIRED" | "LIMIT_REACHED";

export function promotionState(p: Pick<PricingPromotion, "isEnabled" | "startsAt" | "endsAt" | "totalRedemptionLimit" | "redemptionCount">, now: Date): PromotionState {
  if (!p.isEnabled) return "DRAFT";
  if (now.getTime() < p.startsAt.getTime()) return "SCHEDULED";
  if (now.getTime() >= p.endsAt.getTime()) return "EXPIRED";
  if (p.totalRedemptionLimit !== null && p.redemptionCount >= p.totalRedemptionLimit) return "LIMIT_REACHED";
  return "ACTIVE";
}

export function isPromotionLive(p: PricingPromotion, now: Date): boolean {
  return promotionState(p, now) === "ACTIVE";
}

export function promotionAppliesToPlan(p: Pick<PricingPromotion, "appliesToAllPlans" | "planIds">, planId: string): boolean {
  return p.appliesToAllPlans || p.planIds.includes(planId);
}

/** Discount in cents for a base price. Rounds half-up to the nearest cent. */
export function calculateDiscount(
  baseCents: number,
  p: Pick<PricingPromotion, "discountType" | "discountValue" | "maxDiscountCents">,
): number {
  if (!Number.isInteger(baseCents) || baseCents <= 0) return 0;
  let discount: number;
  if (p.discountType === "PERCENTAGE") {
    const bps = Math.min(Math.max(p.discountValue, 0), 10000);
    // Integer arithmetic: floor((base * bps + 5000) / 10000) == round half-up.
    discount = Math.floor((baseCents * bps + 5000) / 10000);
  } else {
    discount = Math.max(p.discountValue, 0);
  }
  if (p.maxDiscountCents !== null && p.maxDiscountCents !== undefined && p.maxDiscountCents >= 0) {
    discount = Math.min(discount, p.maxDiscountCents);
  }
  return Math.min(discount, baseCents);
}

export function normalizeCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase().replace(/\s+/g, "");
  return c === "" ? null : c;
}

export type CouponStatus =
  | "NONE"
  | "APPLIED"
  | "NOT_BETTER" // valid, but an automatic offer gives a bigger discount
  | "INVALID"
  | "NOT_STARTED"
  | "EXPIRED"
  | "LIMIT_REACHED"
  | "NOT_ELIGIBLE_PLAN"
  | "DECLARATION_REQUIRED";

export interface AppliedPromotion {
  id: string;
  name: string;
  slug: string;
  headline: string | null;
  discountType: DiscountTypeValue;
  discountValue: number;
  audience: AudienceValue;
  code: string | null;
  endsAt: Date;
  discountCents: number;
}

export interface Quote {
  basePriceCents: number | null;
  discountCents: number;
  deliveryFeeCents: number;
  /** null when the plan price is "on request". */
  totalCents: number | null;
  promotion: AppliedPromotion | null;
  /** True when the discount depends on manual verification (new/selected customers). */
  requiresVerification: boolean;
  couponStatus: CouponStatus;
  /**
   * A live new-customer offer the customer could request by ticking the
   * first-order declaration (shown as a prompt in the order form).
   */
  availableFirstOrderOffer: { id: string; name: string; discountCents: number; endsAt: Date } | null;
}

export interface QuoteInput {
  plan: PricingPlan;
  promotions: PricingPromotion[];
  now: Date;
  couponCode?: string | null;
  firstOrderDeclared?: boolean;
  deliveryFeeCents?: number | null;
}

function better(a: { discount: number; p: PricingPromotion }, b: { discount: number; p: PricingPromotion }) {
  if (a.discount !== b.discount) return a.discount > b.discount ? a : b;
  if (a.p.priority !== b.p.priority) return a.p.priority > b.p.priority ? a : b;
  return a.p.endsAt.getTime() <= b.p.endsAt.getTime() ? a : b;
}

function toApplied(p: PricingPromotion, discountCents: number): AppliedPromotion {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    headline: p.headline ?? null,
    discountType: p.discountType,
    discountValue: p.discountValue,
    audience: p.audience,
    code: p.requiresCode ? p.code : null,
    endsAt: p.endsAt,
    discountCents,
  };
}

export function computeQuote(input: QuoteInput): Quote {
  const { plan, promotions, now } = input;
  const declared = Boolean(input.firstOrderDeclared);
  const deliveryFeeCents = Math.max(0, input.deliveryFeeCents ?? 0);
  const base = plan.priceCents;
  const coupon = normalizeCode(input.couponCode);

  const empty: Quote = {
    basePriceCents: base,
    discountCents: 0,
    deliveryFeeCents,
    totalCents: base === null ? null : base + deliveryFeeCents,
    promotion: null,
    requiresVerification: false,
    couponStatus: coupon ? "INVALID" : "NONE",
    availableFirstOrderOffer: null,
  };

  // --- Coupon evaluation -------------------------------------------------
  let couponCandidate: { discount: number; p: PricingPromotion } | null = null;
  let couponStatus: CouponStatus = coupon ? "INVALID" : "NONE";
  if (coupon) {
    const match = promotions.find((p) => p.requiresCode && normalizeCode(p.code) === coupon);
    if (match) {
      const state = promotionState(match, now);
      if (state === "DRAFT") couponStatus = "INVALID";
      else if (state === "SCHEDULED") couponStatus = "NOT_STARTED";
      else if (state === "EXPIRED") couponStatus = "EXPIRED";
      else if (state === "LIMIT_REACHED") couponStatus = "LIMIT_REACHED";
      else if (!promotionAppliesToPlan(match, plan.id)) couponStatus = "NOT_ELIGIBLE_PLAN";
      else if (match.audience === "NEW_CUSTOMERS" && !declared) couponStatus = "DECLARATION_REQUIRED";
      else if (base !== null) {
        couponCandidate = { discount: calculateDiscount(base, match), p: match };
        couponStatus = "APPLIED";
      } else {
        couponStatus = "APPLIED";
      }
    }
  }

  if (base === null) {
    return { ...empty, couponStatus };
  }

  // --- Automatic promotions ----------------------------------------------
  let autoCandidate: { discount: number; p: PricingPromotion } | null = null;
  let firstOrderOffer: Quote["availableFirstOrderOffer"] = null;
  for (const p of promotions) {
    if (p.requiresCode || p.audience === "SELECTED_CUSTOMERS") continue;
    if (!isPromotionLive(p, now) || !promotionAppliesToPlan(p, plan.id)) continue;
    const discount = calculateDiscount(base, p);
    if (discount <= 0) continue;
    if (p.audience === "NEW_CUSTOMERS" && !declared) {
      if (!firstOrderOffer || discount > firstOrderOffer.discountCents) {
        firstOrderOffer = { id: p.id, name: p.name, discountCents: discount, endsAt: p.endsAt };
      }
      continue;
    }
    const candidate = { discount, p };
    autoCandidate = autoCandidate ? better(autoCandidate, candidate) : candidate;
  }

  let winner = autoCandidate;
  if (couponCandidate) {
    winner = winner ? better(couponCandidate, winner) : couponCandidate;
    if (winner !== couponCandidate) couponStatus = "NOT_BETTER";
  }

  if (!winner || winner.discount <= 0) {
    return { ...empty, couponStatus, availableFirstOrderOffer: firstOrderOffer };
  }

  // Only prompt for the declaration if it would beat what already applies.
  if (firstOrderOffer && firstOrderOffer.discountCents <= winner.discount) firstOrderOffer = null;

  const discountCents = winner.discount;
  return {
    basePriceCents: base,
    discountCents,
    deliveryFeeCents,
    totalCents: base - discountCents + deliveryFeeCents,
    promotion: toApplied(winner.p, discountCents),
    requiresVerification: winner.p.audience !== "ALL_CUSTOMERS",
    couponStatus,
    availableFirstOrderOffer: firstOrderOffer,
  };
}

export const COUPON_MESSAGES: Record<CouponStatus, string> = {
  NONE: "",
  APPLIED: "Code applied.",
  NOT_BETTER: "Your code is valid, but a better offer is already applied. Offers can't be combined.",
  INVALID: "This code isn't valid.",
  NOT_STARTED: "This code isn't active yet.",
  EXPIRED: "This code has expired.",
  LIMIT_REACHED: "This offer has reached its redemption limit.",
  NOT_ELIGIBLE_PLAN: "This code doesn't apply to the selected plan.",
  DECLARATION_REQUIRED: "This code is for first orders. Please confirm this is your first order to request it.",
};

/** Human label: "20% off" / "€10 off" */
export function discountLabel(p: Pick<PricingPromotion, "discountType" | "discountValue">, currency = "EUR"): string {
  if (p.discountType === "PERCENTAGE") {
    const pct = p.discountValue / 100;
    return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0$/, "")}% off`;
  }
  const amount = new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency,
    minimumFractionDigits: p.discountValue % 100 === 0 ? 0 : 2,
  }).format(p.discountValue / 100);
  return `${amount} off`;
}
