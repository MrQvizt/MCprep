import "server-only";
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { absoluteUrl, siteUrl } from "@/lib/env";
import { getPageSeo } from "@/lib/seo/metadata";
import { STATIC_PAGES, type StaticPageKey } from "@/lib/seo/pages";
import { normalizePath } from "@/lib/urls";

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

/** True when a canonical URL points at this same page (or is empty). */
export function canonicalIsSelf(canonical: string | null | undefined, path: string, baseUrl: string = siteUrl()): boolean {
  if (!canonical || !canonical.trim()) return true;
  const value = canonical.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const target = new URL(value);
      const base = new URL(baseUrl);
      if (target.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) return false;
      return normalizePath(target.pathname) === normalizePath(path);
    } catch {
      return false;
    }
  }
  return normalizePath(value) === normalizePath(path);
}

function hasContent(...values: (string | null | undefined)[]) {
  return values.some((v) => Boolean(v && v.replace(/<[^>]*>/g, "").trim()));
}

/** Landing pages: visible while their promotion runs, or after it ends unless set to disappear. */
function landingIsLive(
  page: { promotion: { endsAt: Date; isEnabled: boolean } | null; expiredBehavior: string },
  now: Date,
): { visible: boolean; expired: boolean } {
  const promo = page.promotion;
  const expired = Boolean(promo && promo.endsAt.getTime() <= now.getTime());
  if (!expired) return { visible: true, expired: false };
  return { visible: page.expiredBehavior !== "HIDE", expired: true };
}

/** Content blocks' last-updated timestamps, keyed by content key. */
async function contentUpdatedAt(): Promise<Map<string, Date>> {
  const rows = await db.pageContent.findMany({ select: { key: true, updatedAt: true } });
  return new Map(rows.map((r) => [r.key, r.updatedAt]));
}

async function seoUpdatedAt(): Promise<Map<string, Date>> {
  const rows = await db.sEOPageMetadata.findMany({ select: { pageKey: true, updatedAt: true } });
  return new Map(rows.map((r) => [r.pageKey, r.updatedAt]));
}

function latest(...dates: (Date | undefined | null)[]): Date | undefined {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  if (valid.length === 0) return undefined;
  return new Date(Math.max(...valid.map((d) => d.getTime())));
}

/**
 * Every indexable public URL. Generated per request from the database, so new
 * blog posts, published offer pages or unpublished content are reflected
 * immediately. Admin, API, order and confirmation pages are never included.
 */
export async function getSitemapEntries(now: Date = new Date()): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const [contentDates, seoDates] = await Promise.all([contentUpdatedAt(), seoUpdatedAt()]);

  // Fixed pages (respecting per-page indexing + canonical overrides)
  for (const page of STATIC_PAGES) {
    if (page.key === "order") continue;
    const seo = await getPageSeo(page.key as StaticPageKey);
    if (seo.noindex) continue;
    if (!canonicalIsSelf(seo.canonical, page.path)) continue;
    const contentKey = "contentKey" in page ? page.contentKey : undefined;
    entries.push({
      url: absoluteUrl(page.path),
      lastModified: latest(contentKey ? contentDates.get(contentKey) : undefined, seoDates.get(page.key)),
      changeFrequency: page.changeFrequency as ChangeFrequency,
      priority: page.priority,
    });
  }

  const [meals, posts, areas, landings] = await Promise.all([
    db.meal.findMany({
      where: { isPublished: true, archivedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.blogPost.findMany({
      where: { status: "PUBLISHED", publishAt: { lte: now }, noindex: false },
      select: { slug: true, contentUpdatedAt: true, canonicalUrl: true, isFeatured: true },
      orderBy: { publishAt: "desc" },
    }),
    db.deliveryArea.findMany({
      where: { isPublished: true, hasPublicPage: true },
      select: { slug: true, updatedAt: true, pageIntro: true, pageBody: true },
    }),
    db.seasonalCampaignLandingPage.findMany({
      where: { isPublished: true, noindex: false },
      select: {
        slug: true,
        updatedAt: true,
        expiredBehavior: true,
        promotion: { select: { endsAt: true, isEnabled: true } },
      },
    }),
  ]);

  for (const meal of meals) {
    entries.push({ url: absoluteUrl(`/menu/${meal.slug}`), lastModified: meal.updatedAt, changeFrequency: "monthly", priority: 0.6 });
  }
  for (const post of posts) {
    const path = `/blog/${post.slug}`;
    if (!canonicalIsSelf(post.canonicalUrl, path)) continue;
    entries.push({
      url: absoluteUrl(path),
      lastModified: post.contentUpdatedAt,
      changeFrequency: "monthly",
      priority: post.isFeatured ? 0.7 : 0.5,
    });
  }
  for (const area of areas) {
    if (!hasContent(area.pageIntro, area.pageBody)) continue;
    entries.push({ url: absoluteUrl(`/delivery-areas/${area.slug}`), lastModified: area.updatedAt, changeFrequency: "monthly", priority: 0.5 });
  }
  for (const page of landings) {
    const state = landingIsLive(page, now);
    // Ended offers are left out of the sitemap unless kept as an information page.
    if (!state.visible || (state.expired && page.expiredBehavior !== "KEEP_INFO_PAGE")) continue;
    entries.push({ url: absoluteUrl(`/offers/${page.slug}`), lastModified: page.updatedAt, changeFrequency: "weekly", priority: 0.5 });
  }
  return entries;
}

/**
 * Every public path that resolves to a page (indexable or not) — used to
 * detect broken internal links. Paths are normalised (lower-case, no trailing slash).
 */
export async function getKnownPublicPaths(now: Date = new Date()): Promise<Set<string>> {
  const paths = new Set<string>(STATIC_PAGES.map((p) => normalizePath(p.path)));
  paths.add("/order/confirmation");
  const [meals, posts, areas, landings] = await Promise.all([
    db.meal.findMany({ where: { isPublished: true, archivedAt: null }, select: { slug: true } }),
    db.blogPost.findMany({ where: { status: "PUBLISHED", publishAt: { lte: now } }, select: { slug: true } }),
    db.deliveryArea.findMany({
      where: { isPublished: true, hasPublicPage: true },
      select: { slug: true, pageIntro: true, pageBody: true },
    }),
    db.seasonalCampaignLandingPage.findMany({
      where: { isPublished: true },
      select: { slug: true, expiredBehavior: true, promotion: { select: { endsAt: true, isEnabled: true } } },
    }),
  ]);
  for (const m of meals) paths.add(normalizePath(`/menu/${m.slug}`));
  for (const p of posts) paths.add(normalizePath(`/blog/${p.slug}`));
  for (const a of areas) if (hasContent(a.pageIntro, a.pageBody)) paths.add(normalizePath(`/delivery-areas/${a.slug}`));
  for (const l of landings) if (landingIsLive(l, now).visible) paths.add(normalizePath(`/offers/${l.slug}`));
  return paths;
}

/** Paths that currently answer with a redirect (internal or external target). */
export async function getActiveRedirectSources(): Promise<Set<string>> {
  const rows = await db.redirectRule.findMany({ where: { isActive: true }, select: { fromPath: true } });
  return new Set(rows.map((r) => normalizePath(r.fromPath)));
}

/** Whether an internal link resolves (page exists or the address redirects). */
export function isResolvablePath(href: string, known: Set<string>, redirects: Set<string>): boolean {
  const path = normalizePath(href);
  return known.has(path) || redirects.has(path);
}
