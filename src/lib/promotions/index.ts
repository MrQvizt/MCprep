import "server-only";
import { db } from "@/lib/db";
import { discountLabel, promotionState, type PricingPromotion, type PromotionState } from "@/lib/pricing";
import type { Prisma, Promotion } from "@/generated/prisma/client";

/** Redemptions that count towards limits: requested (pending) + approved. */
export const COUNTED_REDEMPTION_STATUSES = ["REQUESTED", "APPROVED"] as const;

type PromotionWithPlans = Promotion & { eligiblePlans: { planId: string }[] };

export async function redemptionCounts(promotionIds: string[], tx: Prisma.TransactionClient | typeof db = db) {
  if (promotionIds.length === 0) return new Map<string, number>();
  const rows = await tx.promotionRedemption.groupBy({
    by: ["promotionId"],
    where: { promotionId: { in: promotionIds }, status: { in: [...COUNTED_REDEMPTION_STATUSES] } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.promotionId, r._count._all]));
}

export function toPricingPromotion(p: PromotionWithPlans, redemptionCount: number): PricingPromotion {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    headline: p.headline,
    discountType: p.discountType,
    discountValue: p.discountValue,
    maxDiscountCents: p.maxDiscountCents,
    audience: p.audience,
    requiresCode: p.requiresCode,
    code: p.code,
    appliesToAllPlans: p.appliesToAllPlans,
    planIds: p.eligiblePlans.map((e) => e.planId),
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    isEnabled: p.isEnabled,
    priority: p.priority,
    totalRedemptionLimit: p.totalRedemptionLimit,
    redemptionCount,
  };
}

/**
 * Promotions relevant for pricing right now: enabled and not long expired
 * (recently expired ones are kept so an expired coupon gets a clear message).
 */
export async function getPricingPromotions(
  now: Date,
  tx: Prisma.TransactionClient | typeof db = db,
): Promise<PricingPromotion[]> {
  const rows = await tx.promotion.findMany({
    where: { isEnabled: true, endsAt: { gt: new Date(now.getTime() - 30 * 86_400_000) } },
    include: { eligiblePlans: { select: { planId: true } } },
  });
  const counts = await redemptionCounts(
    rows.map((r) => r.id),
    tx,
  );
  return rows.map((r) => toPricingPromotion(r, counts.get(r.id) ?? 0));
}

export interface PublicPromotion {
  id: string;
  slug: string;
  name: string;
  theme: string;
  headline: string;
  subheadline: string | null;
  description: string | null;
  badgeText: string | null;
  ctaText: string;
  imageUrl: string | null;
  imageAlt: string | null;
  startsAt: string;
  endsAt: string;
  showCountdown: boolean;
  discountLabel: string;
  audience: "ALL_CUSTOMERS" | "NEW_CUSTOMERS" | "SELECTED_CUSTOMERS";
  /** Public coupon code (never shown for selected-customer promotions). */
  code: string | null;
  terms: string | null;
  appliesToAllPlans: boolean;
  planIds: string[];
  state: PromotionState;
  expiredMessage: string | null;
}

type PromotionForPublic = Promotion & {
  eligiblePlans: { planId: string }[];
  image: { url: string; altText: string | null } | null;
};

export function toPublicPromotion(p: PromotionForPublic, redemptionCount: number, now: Date, currency = "EUR"): PublicPromotion {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    theme: p.theme,
    headline: p.headline,
    subheadline: p.subheadline,
    description: p.description,
    badgeText: p.badgeText,
    ctaText: p.ctaText,
    imageUrl: p.image?.url ?? null,
    imageAlt: p.image?.altText ?? null,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    showCountdown: p.showCountdown,
    discountLabel: discountLabel(p, currency),
    audience: p.audience,
    code: p.requiresCode && p.audience !== "SELECTED_CUSTOMERS" ? p.code : null,
    terms: p.terms,
    appliesToAllPlans: p.appliesToAllPlans,
    planIds: p.eligiblePlans.map((e) => e.planId),
    state: promotionState({ ...p, redemptionCount }, now),
    expiredMessage: p.expiredMessage,
  };
}

const PUBLIC_INCLUDE = {
  eligiblePlans: { select: { planId: true } },
  image: { select: { url: true, altText: true } },
} as const;

/** Live (or recently ended, if configured to show an "ended" message) homepage promotion. */
export async function getHomepagePromotion(now: Date, currency = "EUR"): Promise<PublicPromotion | null> {
  const rows = await db.promotion.findMany({
    where: {
      isEnabled: true,
      showOnHomepage: true,
      startsAt: { lte: now },
      endsAt: { gt: new Date(now.getTime() - 7 * 86_400_000) },
      audience: { not: "SELECTED_CUSTOMERS" },
    },
    include: PUBLIC_INCLUDE,
    orderBy: [{ priority: "desc" }, { endsAt: "asc" }],
  });
  const counts = await redemptionCounts(rows.map((r) => r.id));
  const views = rows.map((r) => toPublicPromotion(r, counts.get(r.id) ?? 0, now, currency));
  const live = views.find((v) => v.state === "ACTIVE");
  if (live) return live;
  const ended = rows.find((r, i) => views[i].state === "EXPIRED" && r.expiredBehavior === "SHOW_ENDED_MESSAGE");
  return ended ? views[rows.indexOf(ended)] : null;
}

/** All currently live public promotions (for the /offers page and pricing cards). */
export async function getLivePublicPromotions(now: Date, currency = "EUR"): Promise<PublicPromotion[]> {
  const rows = await db.promotion.findMany({
    where: {
      isEnabled: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
      audience: { not: "SELECTED_CUSTOMERS" },
    },
    include: PUBLIC_INCLUDE,
    orderBy: [{ priority: "desc" }, { endsAt: "asc" }],
  });
  const counts = await redemptionCounts(rows.map((r) => r.id));
  return rows
    .map((r) => toPublicPromotion(r, counts.get(r.id) ?? 0, now, currency))
    .filter((v) => v.state === "ACTIVE");
}

export const THEME_LABELS: Record<string, string> = {
  NONE: "No theme",
  HALLOWEEN: "Halloween",
  BLACK_FRIDAY: "Black Friday",
  CHRISTMAS: "Christmas",
  NEW_YEAR: "New Year",
  VALENTINES: "Valentine's Day",
  SUMMER_FITNESS: "Summer Fitness",
  NEW_CUSTOMER_WELCOME: "New Customer Welcome",
  CUSTOM: "Custom",
};

export const AUDIENCE_LABELS: Record<string, string> = {
  ALL_CUSTOMERS: "All customers",
  NEW_CUSTOMERS: "New customers only (first order)",
  SELECTED_CUSTOMERS: "Selected customers (code required)",
};

export const PROMOTION_STATE_LABELS: Record<PromotionState, string> = {
  DRAFT: "Draft / disabled",
  SCHEDULED: "Scheduled",
  ACTIVE: "Live",
  EXPIRED: "Ended",
  LIMIT_REACHED: "Limit reached",
};
