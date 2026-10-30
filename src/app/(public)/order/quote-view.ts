import "server-only";
import type { QuoteContext } from "@/lib/orders/service";
import { perMealCents } from "@/lib/packages";
import { COUPON_MESSAGES, discountLabel, firstWeekPriceCents, type CouponStatus } from "@/lib/pricing";

export interface QuoteView {
  planName: string;
  /** Packages: meals per week, per-meal price, subscription details. */
  mealsPerWeek: number | null;
  perMealCents: number | null;
  isSubscription: boolean;
  durationDays: number;
  /** Normal price of the first week (for "first week €60 instead of €95"). */
  firstWeekCents: number | null;
  basePriceCents: number | null;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number | null;
  promotion: {
    name: string;
    label: string;
    endsAt: string;
    audience: "ALL_CUSTOMERS" | "NEW_CUSTOMERS" | "SELECTED_CUSTOMERS";
  } | null;
  requiresVerification: boolean;
  couponStatus: CouponStatus;
  couponMessage: string;
  firstOrderOffer: { name: string; discountCents: number; endsAt: string } | null;
  minOrderShortfallCents: number | null;
  deliveryAreaName: string | null;
}

/** Shape a server quote for the browser (shared by the page and the live quote action). */
export function toQuoteView(qc: QuoteContext): QuoteView {
  const q = qc.quote;
  return {
    planName: qc.plan.name,
    mealsPerWeek: qc.plan.mealsPerWeek,
    perMealCents: perMealCents(qc.plan),
    isSubscription: qc.plan.isSubscription,
    durationDays: qc.plan.durationDays,
    firstWeekCents: qc.plan.mealsPerWeek ? firstWeekPriceCents(qc.plan) : null,
    basePriceCents: q.basePriceCents,
    discountCents: q.discountCents,
    deliveryFeeCents: q.deliveryFeeCents,
    totalCents: q.totalCents,
    promotion: q.promotion
      ? {
          name: q.promotion.name,
          label: discountLabel(q.promotion),
          endsAt: q.promotion.endsAt.toISOString(),
          audience: q.promotion.audience,
        }
      : null,
    requiresVerification: q.requiresVerification,
    couponStatus: q.couponStatus,
    couponMessage: COUPON_MESSAGES[q.couponStatus],
    firstOrderOffer: q.availableFirstOrderOffer
      ? {
          name: q.availableFirstOrderOffer.name,
          discountCents: q.availableFirstOrderOffer.discountCents,
          endsAt: q.availableFirstOrderOffer.endsAt.toISOString(),
        }
      : null,
    minOrderShortfallCents: qc.minOrderShortfallCents,
    deliveryAreaName: qc.deliveryArea?.name ?? null,
  };
}

