import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getGrowthReport, getOrderKpis, resolveGrowthPeriod } from "@/lib/admin/growth";
import { createPromotion } from "./helpers";
import { createTestOrder } from "./admin-orders.fixtures";

const NOW = new Date("2026-10-29T12:00:00Z");

describe("growth periods (Malta time)", () => {
  it("resolves month boundaries in Europe/Malta", () => {
    const month = resolveGrowthPeriod("month", NOW);
    expect(month.from.toISOString()).toBe("2026-09-30T22:00:00.000Z"); // 1 Oct 00:00 CEST
    expect(month.to).toEqual(NOW);
    const last = resolveGrowthPeriod("last-month", NOW);
    expect(last.from.toISOString()).toBe("2026-08-31T22:00:00.000Z");
    expect(last.to.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    const week = resolveGrowthPeriod("7d", NOW);
    expect(week.from.toISOString()).toBe("2026-10-22T22:00:00.000Z"); // 23 Oct 00:00 CEST
    expect(resolveGrowthPeriod("nonsense", NOW).key).toBe("30d");
  });

  it("handles January (previous month is December of the previous year)", () => {
    const last = resolveGrowthPeriod("last-month", new Date("2027-01-15T10:00:00Z"));
    expect(last.from.toISOString()).toBe("2026-11-30T23:00:00.000Z"); // 1 Dec 00:00 CET
    expect(last.to.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });
});

describe("growth report", () => {
  it("never fabricates numbers when there is no data", async () => {
    const report = await getGrowthReport(resolveGrowthPeriod("30d", NOW));
    expect(report.orders).toEqual({ total: 0, confirmed: 0, completed: 0, cancelled: 0, open: 0 });
    expect(report.byPlan).toEqual([]);
    expect(report.byCampaign).toEqual([]);
    expect(report.orderSources).toEqual([]);
    expect(report.analytics.pageViews).toBe(0);
    expect(report.topPages).toEqual([]);
    expect(report.funnel.every((f) => f.count === 0)).toBe(true);
    expect(report.sentences).toEqual([]);
    const kpis = await getOrderKpis(NOW);
    expect(kpis.total).toBe(0);
  });

  it("aggregates real orders, campaigns and cookieless events for the period", async () => {
    const at = (iso: string) => new Date(iso);
    const promo = await createPromotion({ name: "Halloween Special", audience: "NEW_CUSTOMERS" });
    await createTestOrder({ planName: "2 Weeks", status: "CONFIRMED", createdAt: at("2026-10-20T10:00:00Z"), utmSource: "instagram" });
    await createTestOrder({ planName: "2 Weeks", status: "NEW", createdAt: at("2026-10-21T10:00:00Z") });
    await createTestOrder({
      planName: "1 Week",
      status: "COMPLETED",
      fulfillmentMethod: "COLLECTION",
      deliveryLocality: null,
      promotionId: promo.id,
      promotionName: "Halloween Special",
      eligibilityStatus: "APPROVED",
      createdAt: at("2026-10-28T10:00:00Z"),
      withRedemption: true,
    });
    await db.promotionRedemption.updateMany({ data: { status: "APPROVED" } });
    // Outside the period — must not be counted.
    await createTestOrder({ planName: "1 Month", createdAt: at("2026-08-01T10:00:00Z") });

    await db.analyticsEvent.createMany({
      data: [
        { name: "page_view", path: "/", utmSource: "instagram", createdAt: at("2026-10-20T09:00:00Z") },
        { name: "page_view", path: "/", referrerHost: "www.google.com", createdAt: at("2026-10-20T09:01:00Z") },
        { name: "page_view", path: "/plans", createdAt: at("2026-10-20T09:02:00Z") },
        { name: "view_pricing", path: "/plans", createdAt: at("2026-10-20T09:02:00Z") },
        { name: "select_plan", path: "/plans", planSlug: "2-weeks", createdAt: at("2026-10-20T09:03:00Z") },
        { name: "begin_order", path: "/order", createdAt: at("2026-10-20T09:04:00Z") },
        { name: "click_whatsapp", path: "/", createdAt: at("2026-10-21T09:00:00Z") },
        { name: "click_whatsapp", path: "/", createdAt: at("2026-10-21T09:05:00Z") },
        { name: "page_view", path: "/", createdAt: at("2026-07-01T09:00:00Z") }, // outside period
      ],
    });
    await db.meal.create({ data: { name: "Chicken Pokébowl", slug: "chicken-pokebowl" } });
    await db.analyticsEvent.create({ data: { name: "view_meal", path: "/menu/chicken-pokebowl", mealSlug: "chicken-pokebowl", createdAt: at("2026-10-22T09:00:00Z") } });

    const report = await getGrowthReport(resolveGrowthPeriod("30d", NOW));
    expect(report.orders).toMatchObject({ total: 3, confirmed: 2, completed: 1, open: 1 });
    expect(report.byPlan).toEqual([
      { label: "2 Weeks", count: 2 },
      { label: "1 Week", count: 1 },
    ]);
    expect(report.byCampaign).toHaveLength(1);
    expect(report.byCampaign[0]).toMatchObject({ name: "Halloween Special", orders: 1, redemptions: { approved: 1, requested: 0 } });
    expect(report.fulfilment).toEqual({ collection: 1, delivery: 2 });
    expect(report.topLocalities).toEqual([{ label: "Sliema", count: 2 }]);
    expect(report.orderSources).toContainEqual({ label: "instagram", count: 1 });
    expect(report.analytics).toMatchObject({ pageViews: 3, whatsappClicks: 2 });
    expect(report.topPages[0]).toEqual({ label: "/", count: 2 });
    expect(report.trafficSources).toEqual(
      expect.arrayContaining([
        { label: "instagram", count: 1 },
        { label: "www.google.com", count: 1 },
        { label: "(direct or unknown)", count: 1 },
      ]),
    );
    expect(report.popularMeals).toEqual([{ label: "Chicken Pokébowl", count: 1 }]);
    // Funnel: analytics steps + real orders from the database (never form visits).
    expect(report.funnel.map((f) => [f.key, f.count, f.source])).toEqual([
      ["view_pricing", 1, "analytics"],
      ["select_plan", 1, "analytics"],
      ["begin_order", 1, "analytics"],
      ["submit_order", 0, "analytics"],
      ["orders", 3, "database"],
    ]);
    expect(report.sentences).toEqual(
      expect.arrayContaining([
        "You received 3 order requests in the last 30 days.",
        "2 of them have been confirmed so far.",
        "Your 2 Weeks package received the most requests.",
        "Your Halloween Special campaign generated 1 order request.",
        "Visitors tapped the WhatsApp button 2 times.",
      ]),
    );
  });

  it("does not claim a top package when packages are tied", async () => {
    await createTestOrder({ planName: "2 Weeks", createdAt: new Date("2026-10-20T10:00:00Z") });
    await createTestOrder({ planName: "1 Week", createdAt: new Date("2026-10-20T11:00:00Z") });
    const report = await getGrowthReport(resolveGrowthPeriod("30d", NOW));
    expect(report.sentences.some((s) => s.includes("package received the most"))).toBe(false);
  });
});
