import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getKnownPublicPaths, getSitemapEntries } from "@/lib/seo/sitemap";
import { createPromotion } from "./helpers";
import { createMeal, createPost } from "./seo.fixtures";

const BASE = "https://mcpreps.test";
const urls = async () => (await getSitemapEntries(new Date())).map((e) => e.url);

describe("sitemap", () => {
  it("lists indexable fixed pages and never admin, API, order or confirmation pages", async () => {
    const list = await urls();
    expect(list).toContain(`${BASE}/`);
    expect(list).toContain(`${BASE}/meal-prep-malta`);
    expect(list).toContain(`${BASE}/delivery-areas`);
    expect(list.some((u) => u.includes("/admin"))).toBe(false);
    expect(list.some((u) => u.includes("/api"))).toBe(false);
    expect(list).not.toContain(`${BASE}/order`);
    expect(list.some((u) => u.includes("/order/confirmation"))).toBe(false);
  });

  it("respects per-page noindex and canonical overrides", async () => {
    await db.sEOPageMetadata.create({ data: { pageKey: "gallery", noindex: true } });
    await db.sEOPageMetadata.create({ data: { pageKey: "faq", canonicalUrl: "/how-it-works" } });
    await db.sEOPageMetadata.create({ data: { pageKey: "about", canonicalUrl: "/about" } });
    const list = await urls();
    expect(list).not.toContain(`${BASE}/gallery`);
    expect(list).not.toContain(`${BASE}/faq`);
    expect(list).toContain(`${BASE}/about`); // self-canonical is fine
  });

  it("includes published meals but not hidden or archived ones", async () => {
    await createMeal({ slug: "chicken-pokebowl" });
    await createMeal({ slug: "hidden-meal", isPublished: false });
    await createMeal({ slug: "old-meal", archivedAt: new Date() });
    const list = await urls();
    expect(list).toContain(`${BASE}/menu/chicken-pokebowl`);
    expect(list).not.toContain(`${BASE}/menu/hidden-meal`);
    expect(list).not.toContain(`${BASE}/menu/old-meal`);
  });

  it("includes only live, indexable blog posts", async () => {
    await createPost({ slug: "live-post" });
    await createPost({ slug: "draft-post", status: "DRAFT" });
    await createPost({ slug: "scheduled-post", publishAt: new Date(Date.now() + 86_400_000) });
    await createPost({ slug: "hidden-post", noindex: true });
    await createPost({ slug: "syndicated-post", canonicalUrl: "https://example.com/original" });
    const list = await urls();
    expect(list).toContain(`${BASE}/blog/live-post`);
    for (const slug of ["draft-post", "scheduled-post", "hidden-post", "syndicated-post"]) {
      expect(list).not.toContain(`${BASE}/blog/${slug}`);
    }
    const entry = (await getSitemapEntries()).find((e) => e.url.endsWith("/blog/live-post"))!;
    expect(entry.lastModified).toBeInstanceOf(Date);
  });

  it("handles offer pages: published + indexable only, and ended offers depending on the setting", async () => {
    const live = await createPromotion({ slug: "live" });
    const ended = await createPromotion({ slug: "ended", startsAt: new Date(Date.now() - 10 * 86_400_000), endsAt: new Date(Date.now() - 86_400_000) });
    const base = { title: "Offer", headline: "Offer" };
    await db.seasonalCampaignLandingPage.createMany({
      data: [
        { ...base, slug: "spring", isPublished: true, noindex: false, promotionId: live.id },
        { ...base, slug: "draft-offer", isPublished: false, noindex: false, promotionId: live.id },
        { ...base, slug: "ads-only", isPublished: true, noindex: true, promotionId: live.id },
        { ...base, slug: "ended-hidden", isPublished: true, noindex: false, promotionId: ended.id, expiredBehavior: "HIDE" },
        { ...base, slug: "ended-info", isPublished: true, noindex: false, promotionId: ended.id, expiredBehavior: "KEEP_INFO_PAGE" },
        { ...base, slug: "ended-message", isPublished: true, noindex: false, promotionId: ended.id, expiredBehavior: "SHOW_EXPIRED_MESSAGE" },
      ],
    });
    const list = await urls();
    expect(list).toContain(`${BASE}/offers/spring`);
    expect(list).toContain(`${BASE}/offers/ended-info`);
    for (const slug of ["draft-offer", "ads-only", "ended-hidden", "ended-message"]) {
      expect(list).not.toContain(`${BASE}/offers/${slug}`);
    }
    const known = await getKnownPublicPaths();
    expect(known.has("/offers/ads-only")).toBe(true); // reachable, just not indexed
    expect(known.has("/offers/ended-hidden")).toBe(false);
    expect(known.has("/offers/draft-offer")).toBe(false);
  });

  it("includes locality pages only when they have their own content", async () => {
    await db.deliveryArea.createMany({
      data: [
        { name: "Sliema", slug: "sliema", isPublished: true, deliveryAvailable: true, hasPublicPage: true, pageIntro: "We deliver to Sliema on Sundays." },
        { name: "Mosta", slug: "mosta", isPublished: true, deliveryAvailable: true, hasPublicPage: true },
        { name: "Qormi", slug: "qormi", isPublished: false, hasPublicPage: true, pageIntro: "Text" },
      ],
    });
    const list = await urls();
    expect(list).toContain(`${BASE}/delivery-areas/sliema`);
    expect(list).not.toContain(`${BASE}/delivery-areas/mosta`);
    expect(list).not.toContain(`${BASE}/delivery-areas/qormi`);
  });
});

describe("robots.txt", () => {
  it("blocks all crawling outside production", async () => {
    const { default: robots } = await import("@/app/robots");
    const r = await robots();
    expect(r.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("allows crawling in production but disallows admin, API and order confirmations", async () => {
    vi.resetModules();
    process.env.ALLOW_INDEXING = "true";
    try {
      const { default: robots } = await import("@/app/robots");
      const r = await robots();
      const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
      expect(rule.allow).toBe("/");
      expect(rule.disallow).toEqual(expect.arrayContaining(["/admin", "/api/", "/order/confirmation"]));
      expect(r.sitemap).toBe(`${BASE}/sitemap.xml`);
    } finally {
      delete process.env.ALLOW_INDEXING;
      vi.resetModules();
    }
  });
});
