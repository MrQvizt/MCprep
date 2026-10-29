import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/env";
import { getMediaMap, MEDIA_SELECT } from "@/lib/media";
import { computeQuote, type PricingPromotion } from "@/lib/pricing";
import { getPricingPromotions } from "@/lib/promotions";
import { getSettings } from "@/lib/settings";

/** Fresh "now" for the request (marks the route dynamic). */
export const requestNow = cache(async () => {
  await connection();
  return new Date();
});

// ── Brand ───────────────────────────────────────────────────────────────────

export const getBrandAssets = cache(async () => {
  const settings = await getSettings();
  const b = settings.branding;
  const map = await getMediaMap([b.logoMediaId, b.logoAltMediaId, b.faviconMediaId, b.socialShareMediaId]);
  const logo = b.logoMediaId ? map.get(b.logoMediaId) ?? null : null;
  const logoAlt = b.logoAltMediaId ? map.get(b.logoAltMediaId) ?? null : null;
  const favicon = b.faviconMediaId ? map.get(b.faviconMediaId) ?? null : null;
  const share = b.socialShareMediaId ? map.get(b.socialShareMediaId) ?? null : null;
  return {
    logoText: b.logoText || settings.business.tradingName,
    logo,
    logoAlt,
    favicon,
    share,
    logoAbsoluteUrl: logo ? absoluteUrl(logo.url) : null,
  };
});

// ── Plans ───────────────────────────────────────────────────────────────────

export interface PublicPlan {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  durationDays: number;
  mealsIncluded: number | null;
  features: string[];
  priceCents: number | null;
  savingsLabel: string | null;
  isRecommended: boolean;
  isDemo: boolean;
  /** Best live offer for this plan (automatic or first-order), if any. */
  offer: {
    promotionId: string;
    promotionSlug: string;
    name: string;
    discountCents: number;
    priceCents: number;
    firstOrderOnly: boolean;
    endsAt: string;
  } | null;
}

export function bestOfferForPlan(plan: { id: string; priceCents: number | null }, promotions: PricingPromotion[], now: Date) {
  if (plan.priceCents === null) return null;
  // Evaluate as if the first-order declaration were given, to show the best possible offer
  // (labelled "first order" when it depends on verification).
  const quote = computeQuote({ plan, promotions, now, firstOrderDeclared: true });
  if (!quote.promotion || quote.discountCents <= 0) return null;
  return {
    promotionId: quote.promotion.id,
    promotionSlug: quote.promotion.slug,
    name: quote.promotion.name,
    discountCents: quote.discountCents,
    priceCents: plan.priceCents - quote.discountCents,
    firstOrderOnly: quote.promotion.audience === "NEW_CUSTOMERS",
    endsAt: quote.promotion.endsAt.toISOString(),
  };
}

export const getPublicPlans = cache(async (): Promise<PublicPlan[]> => {
  const now = await requestNow();
  const [plans, promotions] = await Promise.all([
    db.plan.findMany({ where: { isActive: true, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { durationDays: "asc" }] }),
    getPricingPromotions(now),
  ]);
  return plans.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    durationDays: p.durationDays,
    mealsIncluded: p.mealsIncluded,
    features: p.features,
    priceCents: p.priceCents,
    savingsLabel: p.savingsLabel,
    isRecommended: p.isRecommended,
    isDemo: p.isDemo,
    offer: bestOfferForPlan(p, promotions, now),
  }));
});

// ── Meals ───────────────────────────────────────────────────────────────────

const MEAL_PUBLIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  calories: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
  servingSize: true,
  ingredients: true,
  nutritionSource: true,
  nutritionVerified: true,
  dietaryTags: true,
  allergens: true,
  label: true,
  isFeatured: true,
  isDemo: true,
  seoTitle: true,
  seoDescription: true,
  updatedAt: true,
  image: { select: MEDIA_SELECT },
  images: { orderBy: { sortOrder: "asc" as const }, select: { mediaAsset: { select: MEDIA_SELECT } } },
} as const;

export type PublicMeal = Awaited<ReturnType<typeof getPublishedMeals>>[number];

export const getPublishedMeals = cache(async (opts: { featuredOnly?: boolean; limit?: number } = {}) => {
  await connection();
  const meals = await db.meal.findMany({
    where: { isPublished: true, archivedAt: null, ...(opts.featuredOnly ? { isFeatured: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: opts.limit,
    select: MEAL_PUBLIC_SELECT,
  });
  return meals;
});

/** Featured meals; falls back to the latest published meals when none are featured. */
export async function getFeaturedMeals(limit: number) {
  const featured = await getPublishedMeals({ featuredOnly: true, limit });
  if (featured.length > 0) return featured;
  return getPublishedMeals({ limit });
}

export const getMealBySlug = cache(async (slug: string) => {
  await connection();
  return db.meal.findFirst({ where: { slug, isPublished: true, archivedAt: null }, select: MEAL_PUBLIC_SELECT });
});

// ── FAQ, gallery, testimonials ──────────────────────────────────────────────

export const getPublishedFaqs = cache(async (opts: { homepageOnly?: boolean } = {}) => {
  await connection();
  return db.fAQ.findMany({
    where: { isPublished: true, ...(opts.homepageOnly ? { showOnHomepage: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true, category: true },
  });
});

export const getGalleryItems = cache(async (opts: { featuredOnly?: boolean; limit?: number } = {}) => {
  await connection();
  return db.galleryItem.findMany({
    where: { isPublished: true, ...(opts.featuredOnly ? { isFeatured: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: opts.limit,
    select: {
      id: true,
      caption: true,
      altText: true,
      instagramUrl: true,
      mediaAsset: { select: MEDIA_SELECT },
    },
  });
});

export const getPublishedTestimonials = cache(async () => {
  await connection();
  return db.testimonial.findMany({
    // Only testimonials with a recorded permission are ever shown.
    where: { isPublished: true, consentRecordedAt: { not: null } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, quote: true, displayName: true, context: true, photo: { select: MEDIA_SELECT } },
  });
});

// ── Fulfilment ──────────────────────────────────────────────────────────────

export const getDeliveryAreas = cache(async () => {
  await connection();
  return db.deliveryArea.findMany({
    where: { isPublished: true },
    orderBy: [{ region: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      region: true,
      deliveryAvailable: true,
      deliveryFeeCents: true,
      minOrderCents: true,
      deliveryDays: true,
      deliveryWindow: true,
      notes: true,
      zone: true,
      hasPublicPage: true,
    },
  });
});

export const getCollectionPoints = cache(async () => {
  await connection();
  const points = await db.collectionPoint.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      address: true,
      showAddressPublicly: true,
      instructions: true,
      availableDays: true,
      timeWindows: true,
    },
  });
  // Never expose an address the owner chose to keep private.
  return points.map((p) => ({ ...p, address: p.showAddressPublicly ? p.address : null }));
});
