import { describe, expect, it } from "vitest";
import { canPreviewPost, isPostPublic, paginate, parsePage, publicPostWhere, readingMinutes } from "@/lib/public/blog";
import { groupByRegion, hasLocalityPage, LOCALITY_PAGE_MIN_CHARS } from "@/lib/public/delivery";
import { orderHref, resolveLandingPage, type LandingInput } from "@/lib/public/landing";

const NOW = new Date("2026-10-29T12:00:00Z");

describe("blog visibility", () => {
  it("shows only published posts whose publish time has passed", () => {
    expect(isPostPublic({ status: "PUBLISHED", publishAt: new Date("2026-10-01T00:00:00Z") }, NOW)).toBe(true);
    expect(isPostPublic({ status: "PUBLISHED", publishAt: null }, NOW)).toBe(true);
    expect(isPostPublic({ status: "PUBLISHED", publishAt: new Date("2026-11-01T00:00:00Z") }, NOW)).toBe(false); // scheduled
    expect(isPostPublic({ status: "DRAFT", publishAt: new Date("2026-10-01T00:00:00Z") }, NOW)).toBe(false);
  });

  it("builds a matching Prisma filter", () => {
    expect(publicPostWhere(NOW)).toEqual({ status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: NOW } }] });
  });

  it("allows previews only with the exact token", () => {
    expect(canPreviewPost({ previewToken: "abc123" }, "abc123")).toBe(true);
    expect(canPreviewPost({ previewToken: "abc123" }, "abc")).toBe(false);
    expect(canPreviewPost({ previewToken: null }, "")).toBe(false);
    expect(canPreviewPost({ previewToken: null }, undefined)).toBe(false);
  });

  it("parses page numbers and paginates safely", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2"])).toBe(2);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(paginate(20, 3, 9)).toEqual({ page: 3, pages: 3, skip: 18, take: 9 });
    expect(paginate(20, 99, 9).page).toBe(3);
    expect(paginate(0, 1, 9)).toEqual({ page: 1, pages: 1, skip: 0, take: 9 });
  });

  it("estimates reading time", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes(Array(660).fill("word").join(" "))).toBe(3);
  });
});

describe("campaign landing page rules", () => {
  const page = (overrides: Partial<LandingInput> = {}): LandingInput => ({
    isPublished: true,
    noindex: false,
    expiredBehavior: "SHOW_EXPIRED_MESSAGE",
    ...overrides,
  });

  it("renders a live, indexable page while the promotion runs", () => {
    expect(resolveLandingPage(page(), "ACTIVE", { isAdmin: false })).toEqual({ kind: "render", mode: "live", preview: false, noindex: false });
  });

  it("respects the page's noindex setting", () => {
    expect(resolveLandingPage(page({ noindex: true }), "ACTIVE", { isAdmin: false })).toMatchObject({ noindex: true });
  });

  it("hides unpublished pages from visitors but lets admins preview them (noindex)", () => {
    expect(resolveLandingPage(page({ isPublished: false }), "ACTIVE", { isAdmin: false })).toEqual({ kind: "not-found" });
    expect(resolveLandingPage(page({ isPublished: false }), "ACTIVE", { isAdmin: true })).toEqual({
      kind: "render",
      mode: "live",
      preview: true,
      noindex: true,
    });
  });

  it("applies the expired behaviour once the promotion has ended", () => {
    expect(resolveLandingPage(page({ expiredBehavior: "HIDE" }), "EXPIRED", { isAdmin: false })).toEqual({ kind: "not-found" });
    expect(resolveLandingPage(page({ expiredBehavior: "REDIRECT_TO_OFFERS" }), "EXPIRED", { isAdmin: false })).toEqual({
      kind: "redirect",
      to: "/offers",
    });
    expect(resolveLandingPage(page({ expiredBehavior: "SHOW_EXPIRED_MESSAGE" }), "EXPIRED", { isAdmin: false })).toMatchObject({
      kind: "render",
      mode: "expired",
      noindex: true,
    });
    expect(resolveLandingPage(page({ expiredBehavior: "KEEP_INFO_PAGE" }), "EXPIRED", { isAdmin: false })).toMatchObject({
      kind: "render",
      mode: "info",
      noindex: false,
    });
  });

  it("treats limit-reached and disabled promotions as ended", () => {
    expect(resolveLandingPage(page(), "LIMIT_REACHED", { isAdmin: false })).toMatchObject({ mode: "expired" });
    expect(resolveLandingPage(page(), "DRAFT", { isAdmin: false })).toMatchObject({ mode: "expired" });
  });

  it("shows an upcoming teaser (never indexed) before the start time", () => {
    expect(resolveLandingPage(page(), "SCHEDULED", { isAdmin: false })).toMatchObject({ mode: "upcoming", noindex: true });
  });

  it("renders pages without a promotion as live", () => {
    expect(resolveLandingPage(page(), null, { isAdmin: false })).toMatchObject({ mode: "live" });
  });

  it("lets admins see hidden/redirected ended pages as a preview", () => {
    expect(resolveLandingPage(page({ expiredBehavior: "HIDE" }), "EXPIRED", { isAdmin: true })).toMatchObject({
      kind: "render",
      mode: "expired",
      preview: true,
      noindex: true,
    });
  });

  it("builds order links with plan, promotion and campaign tags", () => {
    expect(orderHref({ plan: "2-weeks", promo: "halloween-special", utmCampaign: "halloween" })).toBe(
      "/order?plan=2-weeks&promo=halloween-special&utm_campaign=halloween",
    );
    expect(orderHref({})).toBe("/order");
  });
});

describe("delivery areas", () => {
  it("groups localities by region in a fixed order", () => {
    const groups = groupByRegion([
      { region: "GOZO" as const, name: "Victoria" },
      { region: "MALTA" as const, name: "Sliema" },
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Malta", "Gozo"]);
  });

  it("only gives a locality its own page when it has enough unique content", () => {
    const base = { isPublished: true, hasPublicPage: true, pageIntro: null, pageBody: null };
    expect(hasLocalityPage(base)).toBe(false);
    expect(hasLocalityPage({ ...base, pageBody: "x".repeat(LOCALITY_PAGE_MIN_CHARS) })).toBe(true);
    expect(hasLocalityPage({ ...base, isPublished: false, pageBody: "x".repeat(500) })).toBe(false);
    expect(hasLocalityPage({ ...base, hasPublicPage: false, pageBody: "x".repeat(500) })).toBe(false);
  });
});
