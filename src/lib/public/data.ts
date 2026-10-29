import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { absoluteUrl, siteUrl } from "@/lib/env";
import { MEDIA_SELECT } from "@/lib/media";
import { redemptionCounts, toPublicPromotion, type PublicPromotion } from "@/lib/promotions";
import { getBrandAssets, getDeliveryAreas, getPublicPlans, requestNow } from "@/lib/public-data";
import type { CatalogPlan, JsonLdContext } from "@/lib/seo/jsonld";
import { getSettings } from "@/lib/settings";
import { paginate, publicPostWhere } from "./blog";

// ── JSON-LD ─────────────────────────────────────────────────────────────────

export const getJsonLdContext = cache(async (): Promise<JsonLdContext> => {
  const [settings, brand] = await Promise.all([getSettings(), getBrandAssets()]);
  return {
    siteUrl: siteUrl(),
    settings,
    logoUrl: brand.logoAbsoluteUrl,
    imageUrl: brand.share ? absoluteUrl(brand.share.url) : null,
  };
});

/** Areas actually served + priced, non-demo plans for LocalBusiness structured data. */
export const getLocalBusinessExtras = cache(async () => {
  const [areas, plans] = await Promise.all([getDeliveryAreas(), getPublicPlans()]);
  const servedAreas = areas.filter((a) => a.deliveryAvailable).map((a) => ({ name: a.name }));
  const catalog: CatalogPlan[] = plans
    .filter((p) => p.priceCents !== null && !p.isDemo)
    .map((p) => ({ name: p.name, description: p.description, priceCents: p.priceCents, slug: p.slug }));
  return { servedAreas, catalog };
});

// ── Blog ────────────────────────────────────────────────────────────────────

const POST_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverAlt: true,
  publishAt: true,
  createdAt: true,
  contentUpdatedAt: true,
  isFeatured: true,
  authorName: true,
  coverImage: { select: MEDIA_SELECT },
  category: { select: { name: true, slug: true } },
} as const;

export type BlogCard = Awaited<ReturnType<typeof getBlogListing>>["posts"][number];

export const getBlogCategories = cache(async () => {
  const now = await requestNow();
  const categories = await db.blogCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, _count: { select: { posts: { where: publicPostWhere(now) } } } },
  });
  return categories.filter((c) => c._count.posts > 0);
});

export async function getBlogListing(opts: { categorySlug?: string | null; page: number }) {
  const now = await requestNow();
  const where = {
    ...publicPostWhere(now),
    ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
  };
  const total = await db.blogPost.count({ where });
  const p = paginate(total, opts.page);
  const posts = await db.blogPost.findMany({
    where,
    orderBy: [{ isFeatured: "desc" }, { publishAt: "desc" }, { createdAt: "desc" }],
    skip: p.skip,
    take: p.take,
    select: POST_CARD_SELECT,
  });
  return { posts, total, ...p };
}

export async function getLatestPosts(limit: number, excludeId?: string, categoryId?: string | null) {
  const now = await requestNow();
  const base = { ...publicPostWhere(now), ...(excludeId ? { id: { not: excludeId } } : {}) };
  const related = categoryId
    ? await db.blogPost.findMany({
        where: { ...base, categoryId },
        orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: POST_CARD_SELECT,
      })
    : [];
  if (related.length >= limit) return related;
  const more = await db.blogPost.findMany({
    where: { ...base, id: { notIn: [...related.map((r) => r.id), ...(excludeId ? [excludeId] : [])] } },
    orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
    take: limit - related.length,
    select: POST_CARD_SELECT,
  });
  return [...related, ...more];
}

export const getBlogPost = cache(async (slug: string) => {
  return db.blogPost.findUnique({
    where: { slug },
    include: {
      coverImage: { select: MEDIA_SELECT },
      ogImage: { select: MEDIA_SELECT },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
});

// ── Campaign landing pages ──────────────────────────────────────────────────

export const getLandingPage = cache(async (slug: string) => {
  const page = await db.seasonalCampaignLandingPage.findUnique({
    where: { slug },
    include: {
      heroImage: { select: MEDIA_SELECT },
      ogImage: { select: MEDIA_SELECT },
      promotion: {
        include: {
          eligiblePlans: { select: { planId: true } },
          image: { select: { url: true, altText: true } },
        },
      },
    },
  });
  if (!page) return null;
  let promotion: PublicPromotion | null = null;
  if (page.promotion && page.promotion.audience !== "SELECTED_CUSTOMERS") {
    const now = await requestNow();
    const settings = await getSettings();
    const counts = await redemptionCounts([page.promotion.id]);
    promotion = toPublicPromotion(page.promotion, counts.get(page.promotion.id) ?? 0, now, settings.business.currency);
  }
  return { page, promotion };
});

/** Published landing pages whose linked promotion is currently live (for /offers). */
export async function getLiveLandingPages(livePromotionIds: string[]) {
  return db.seasonalCampaignLandingPage.findMany({
    where: {
      isPublished: true,
      OR: [{ promotionId: { in: livePromotionIds } }, { promotionId: null }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      headline: true,
      subheadline: true,
      promotionId: true,
      heroImage: { select: MEDIA_SELECT },
    },
  });
}

// ── Localities ──────────────────────────────────────────────────────────────

export const getLocality = cache(async (slug: string) => {
  return db.deliveryArea.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      region: true,
      isPublished: true,
      deliveryAvailable: true,
      deliveryFeeCents: true,
      minOrderCents: true,
      deliveryDays: true,
      deliveryWindow: true,
      notes: true,
      hasPublicPage: true,
      pageIntro: true,
      pageBody: true,
      updatedAt: true,
    },
  });
});

export async function getLocalityPageSlugs() {
  return db.deliveryArea.findMany({
    where: { isPublished: true, hasPublicPage: true },
    select: { slug: true, name: true, isPublished: true, hasPublicPage: true, pageIntro: true, pageBody: true },
  });
}
