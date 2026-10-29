import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getBlogListing, getLandingPage, getLiveLandingPages } from "@/lib/public/data";
import { resolveLandingPage } from "@/lib/public/landing";
import { createPromotion } from "./helpers";

const HOUR = 3_600_000;

describe("public blog listing", () => {
  it("lists only published posts whose publish time has passed, featured first", async () => {
    const cat = await db.blogCategory.create({ data: { name: "Meal Prep", slug: "meal-prep" } });
    const now = Date.now();
    await db.blogPost.createMany({
      data: [
        { slug: "live-old", title: "Live old", status: "PUBLISHED", publishAt: new Date(now - 48 * HOUR), categoryId: cat.id },
        { slug: "live-featured", title: "Live featured", status: "PUBLISHED", publishAt: new Date(now - 72 * HOUR), isFeatured: true },
        { slug: "scheduled", title: "Scheduled", status: "PUBLISHED", publishAt: new Date(now + 48 * HOUR) },
        { slug: "draft", title: "Draft", status: "DRAFT", publishAt: new Date(now - 48 * HOUR) },
      ],
    });
    const listing = await getBlogListing({ page: 1 });
    expect(listing.posts.map((p) => p.slug)).toEqual(["live-featured", "live-old"]);
    expect(listing.total).toBe(2);

    const filtered = await getBlogListing({ categorySlug: "meal-prep", page: 1 });
    expect(filtered.posts.map((p) => p.slug)).toEqual(["live-old"]);
  });
});

describe("campaign landing pages", () => {
  it("loads a landing page with its live promotion and resolves it as live", async () => {
    const promo = await createPromotion({ slug: "halloween-special", audience: "NEW_CUSTOMERS" });
    await db.seasonalCampaignLandingPage.create({
      data: { slug: "halloween", title: "Halloween", headline: "Halloween fuel deal", promotionId: promo.id, isPublished: true, noindex: true },
    });
    const data = await getLandingPage("halloween");
    expect(data?.promotion?.state).toBe("ACTIVE");
    expect(resolveLandingPage(data!.page, data!.promotion!.state, { isAdmin: false })).toMatchObject({ kind: "render", mode: "live", noindex: true });

    const live = await getLiveLandingPages([promo.id]);
    expect(live.map((p) => p.slug)).toEqual(["halloween"]);
  });

  it("stops treating the offer as live once the campaign end time has passed", async () => {
    const promo = await createPromotion({
      slug: "black-friday",
      startsAt: new Date(Date.now() - 96 * HOUR),
      endsAt: new Date(Date.now() - 1000),
    });
    await db.seasonalCampaignLandingPage.create({
      data: {
        slug: "black-friday",
        title: "Black Friday",
        headline: "Black Friday",
        promotionId: promo.id,
        isPublished: true,
        expiredBehavior: "REDIRECT_TO_OFFERS",
      },
    });
    const data = await getLandingPage("black-friday");
    expect(data?.promotion?.state).toBe("EXPIRED");
    expect(resolveLandingPage(data!.page, data!.promotion!.state, { isAdmin: false })).toEqual({ kind: "redirect", to: "/offers" });
    // Ended campaigns are not listed on /offers.
    expect(await getLiveLandingPages([])).toEqual([]);
  });

  it("never exposes selected-customer promotions on public landing pages", async () => {
    const promo = await createPromotion({ slug: "vip", audience: "SELECTED_CUSTOMERS", requiresCode: true, code: "VIP10" });
    await db.seasonalCampaignLandingPage.create({
      data: { slug: "vip", title: "VIP", headline: "VIP", promotionId: promo.id, isPublished: true },
    });
    const data = await getLandingPage("vip");
    expect(data?.promotion).toBeNull();
  });

  it("returns null for unknown pages", async () => {
    expect(await getLandingPage("does-not-exist")).toBeNull();
  });
});
