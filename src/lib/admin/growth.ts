import "server-only";
import { db } from "@/lib/db";
import { addDaysToDateString, DEFAULT_TIME_ZONE, startOfZonedDay, zonedDateString, zonedLocalToUtc, zonedParts } from "@/lib/time";

// ── Periods (Malta time boundaries) ─────────────────────────────────────────

export const GROWTH_PERIODS = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month: "This month",
  "last-month": "Last month",
} as const;

export type GrowthPeriodKey = keyof typeof GROWTH_PERIODS;

export interface GrowthPeriod {
  key: GrowthPeriodKey;
  label: string;
  /** Phrase for sentences: "in the last 7 days", "this month" … */
  phrase: string;
  from: Date;
  to: Date; // exclusive
}

const pad = (n: number) => String(n).padStart(2, "0");

export function resolveGrowthPeriod(key: string | undefined, now: Date, timeZone: string = DEFAULT_TIME_ZONE): GrowthPeriod {
  const k: GrowthPeriodKey = key && key in GROWTH_PERIODS ? (key as GrowthPeriodKey) : "30d";
  const today = zonedDateString(now, timeZone);
  if (k === "7d" || k === "30d" || k === "90d") {
    const days = k === "7d" ? 7 : k === "30d" ? 30 : 90;
    const from = zonedLocalToUtc(`${addDaysToDateString(today, -(days - 1))}T00:00`, timeZone) ?? startOfZonedDay(now, timeZone);
    return { key: k, label: GROWTH_PERIODS[k], phrase: `in the last ${days} days`, from, to: now };
  }
  const p = zonedParts(now, timeZone);
  const thisMonthStart = zonedLocalToUtc(`${p.year}-${pad(p.month)}-01T00:00`, timeZone)!;
  if (k === "month") return { key: k, label: GROWTH_PERIODS[k], phrase: "this month", from: thisMonthStart, to: now };
  const prevYear = p.month === 1 ? p.year - 1 : p.year;
  const prevMonth = p.month === 1 ? 12 : p.month - 1;
  const lastMonthStart = zonedLocalToUtc(`${prevYear}-${pad(prevMonth)}-01T00:00`, timeZone)!;
  return { key: k, label: GROWTH_PERIODS[k], phrase: "last month", from: lastMonthStart, to: thisMonthStart };
}

// ── Report ──────────────────────────────────────────────────────────────────

export interface CountRow {
  label: string;
  count: number;
}

export interface CampaignRow {
  promotionId: string | null;
  name: string;
  orders: number;
  redemptions: { requested: number; approved: number; rejected: number; cancelled: number };
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  source: "analytics" | "database";
}

export interface GrowthReport {
  period: GrowthPeriod;
  orders: { total: number; confirmed: number; completed: number; cancelled: number; open: number };
  byPlan: CountRow[];
  byCampaign: CampaignRow[];
  fulfilment: { collection: number; delivery: number };
  topLocalities: CountRow[];
  orderSources: CountRow[];
  analytics: {
    totalEvents: number;
    pageViews: number;
    whatsappClicks: number;
    instagramClicks: number;
    phoneClicks: number;
    emailClicks: number;
  };
  topPages: CountRow[];
  trafficSources: CountRow[];
  popularMeals: CountRow[];
  funnel: FunnelStep[];
  sentences: string[];
}

const CONFIRMED_STATUSES = ["CONFIRMED", "IN_PREPARATION", "COMPLETED"] as const;

function sortRows(rows: CountRow[], limit = 10): CountRow[] {
  return rows
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Owner-friendly summary sentences. Only produced from real, non-zero data —
 * an empty period yields no sentences (never placeholder numbers).
 */
export function buildGrowthSentences(r: Omit<GrowthReport, "sentences">): string[] {
  const out: string[] = [];
  const p = r.period.phrase;
  if (r.orders.total > 0) {
    out.push(`You received ${plural(r.orders.total, "order request")} ${p}.`);
    if (r.orders.confirmed > 0) {
      out.push(
        r.orders.total === 1
          ? "It has been confirmed."
          : `${r.orders.confirmed} of them ${r.orders.confirmed === 1 ? "has" : "have"} been confirmed so far.`,
      );
    }
  }
  const [top, second] = r.byPlan;
  if (top && top.count > 0 && (!second || top.count > second.count)) {
    out.push(`Your ${top.label} package received the most requests.`);
  }
  for (const c of r.byCampaign) {
    if (c.orders > 0 && c.promotionId) out.push(`Your ${c.name} campaign generated ${plural(c.orders, "order request")}.`);
  }
  if (r.fulfilment.delivery > 0 && r.fulfilment.collection > 0) {
    const share = Math.round((r.fulfilment.delivery / (r.fulfilment.delivery + r.fulfilment.collection)) * 100);
    out.push(`${share}% of requests chose delivery.`);
  }
  if (r.analytics.whatsappClicks > 0) {
    out.push(`Visitors tapped the WhatsApp button ${plural(r.analytics.whatsappClicks, "time")}.`);
  }
  if (r.topPages[0] && r.analytics.pageViews > 0) {
    out.push(`Your most visited page was ${r.topPages[0].label === "/" ? "the homepage" : r.topPages[0].label}.`);
  }
  if (r.popularMeals[0]) out.push(`${r.popularMeals[0].label} was the most viewed meal.`);
  return out;
}

export async function getGrowthReport(period: GrowthPeriod): Promise<GrowthReport> {
  const range = { gte: period.from, lt: period.to };
  const orderWhere = { createdAt: range };
  const eventWhere = { createdAt: range };

  const [
    byStatus,
    byPlanRaw,
    byCampaignRaw,
    redemptionsRaw,
    fulfilmentRaw,
    localitiesRaw,
    orderSourcesRaw,
    eventsRaw,
    pagesRaw,
    trafficRaw,
    mealsRaw,
  ] = await Promise.all([
    db.order.groupBy({ by: ["status"], where: orderWhere, _count: { _all: true } }),
    db.order.groupBy({ by: ["planName"], where: orderWhere, _count: { _all: true } }),
    db.order.groupBy({
      by: ["promotionId", "promotionName"],
      where: { ...orderWhere, promotionName: { not: null } },
      _count: { _all: true },
    }),
    db.promotionRedemption.groupBy({ by: ["promotionId", "status"], where: { order: { createdAt: range } }, _count: { _all: true } }),
    db.order.groupBy({ by: ["fulfillmentMethod"], where: orderWhere, _count: { _all: true } }),
    db.order.groupBy({
      by: ["deliveryLocality"],
      where: { ...orderWhere, fulfillmentMethod: "DELIVERY", deliveryLocality: { not: null } },
      _count: { _all: true },
    }),
    db.$queryRaw<{ source: string; count: number }[]>`
      SELECT COALESCE(NULLIF("utmSource", ''), NULLIF("referrerHost", ''), '(not recorded)') AS source, COUNT(*)::int AS count
      FROM "Order" WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    db.analyticsEvent.groupBy({ by: ["name"], where: eventWhere, _count: { _all: true } }),
    db.analyticsEvent.groupBy({
      by: ["path"],
      where: { ...eventWhere, name: "page_view", path: { not: null } },
      _count: { _all: true },
    }),
    db.$queryRaw<{ source: string; count: number }[]>`
      SELECT COALESCE(NULLIF("utmSource", ''), NULLIF("referrerHost", ''), '(direct or unknown)') AS source, COUNT(*)::int AS count
      FROM "AnalyticsEvent" WHERE "name" = 'page_view' AND "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    db.analyticsEvent.groupBy({
      by: ["mealSlug"],
      where: { ...eventWhere, name: "view_meal", mealSlug: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const statusCount = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const total = byStatus.reduce((sum, r) => sum + r._count._all, 0);
  const orders = {
    total,
    confirmed: CONFIRMED_STATUSES.reduce((sum, s) => sum + statusCount(s), 0),
    completed: statusCount("COMPLETED"),
    cancelled: statusCount("CANCELLED"),
    open: statusCount("NEW") + statusCount("CONTACTED"),
  };

  // Campaigns: merge order counts with redemption status counts.
  const redemptionByPromo = new Map<string, CampaignRow["redemptions"]>();
  for (const r of redemptionsRaw) {
    const entry = redemptionByPromo.get(r.promotionId) ?? { requested: 0, approved: 0, rejected: 0, cancelled: 0 };
    const key = r.status.toLowerCase() as keyof CampaignRow["redemptions"];
    entry[key] += r._count._all;
    redemptionByPromo.set(r.promotionId, entry);
  }
  const campaignMap = new Map<string, CampaignRow>();
  for (const c of byCampaignRaw) {
    const key = c.promotionId ?? `name:${c.promotionName}`;
    const existing = campaignMap.get(key);
    if (existing) existing.orders += c._count._all;
    else
      campaignMap.set(key, {
        promotionId: c.promotionId,
        name: c.promotionName ?? "Promotion",
        orders: c._count._all,
        redemptions: (c.promotionId && redemptionByPromo.get(c.promotionId)) || { requested: 0, approved: 0, rejected: 0, cancelled: 0 },
      });
  }
  const byCampaign = [...campaignMap.values()].sort((a, b) => b.orders - a.orders);

  const eventCount = (n: string) => eventsRaw.find((e) => e.name === n)?._count._all ?? 0;

  const mealSlugs = mealsRaw.map((m) => m.mealSlug).filter((s): s is string => Boolean(s));
  const meals = mealSlugs.length
    ? await db.meal.findMany({ where: { slug: { in: mealSlugs } }, select: { slug: true, name: true } })
    : [];
  const mealNames = new Map(meals.map((m) => [m.slug, m.name]));

  const base: Omit<GrowthReport, "sentences"> = {
    period,
    orders,
    byPlan: sortRows(byPlanRaw.map((r) => ({ label: r.planName, count: r._count._all }))),
    byCampaign,
    fulfilment: {
      collection: fulfilmentRaw.find((r) => r.fulfillmentMethod === "COLLECTION")?._count._all ?? 0,
      delivery: fulfilmentRaw.find((r) => r.fulfillmentMethod === "DELIVERY")?._count._all ?? 0,
    },
    topLocalities: sortRows(localitiesRaw.map((r) => ({ label: r.deliveryLocality ?? "", count: r._count._all })), 8),
    orderSources: total > 0 ? sortRows(orderSourcesRaw.map((r) => ({ label: r.source, count: Number(r.count) }))) : [],
    analytics: {
      totalEvents: eventsRaw.reduce((sum, e) => sum + e._count._all, 0),
      pageViews: eventCount("page_view"),
      whatsappClicks: eventCount("click_whatsapp"),
      instagramClicks: eventCount("click_instagram"),
      phoneClicks: eventCount("click_phone"),
      emailClicks: eventCount("click_email"),
    },
    topPages: sortRows(pagesRaw.map((r) => ({ label: r.path ?? "", count: r._count._all }))),
    trafficSources: sortRows(trafficRaw.map((r) => ({ label: r.source, count: Number(r.count) }))),
    popularMeals: sortRows(mealsRaw.map((r) => ({ label: mealNames.get(r.mealSlug ?? "") ?? r.mealSlug ?? "", count: r._count._all })), 8),
    funnel: [
      { key: "view_pricing", label: "Viewed prices", count: eventCount("view_pricing"), source: "analytics" },
      { key: "select_plan", label: "Chose a plan", count: eventCount("select_plan"), source: "analytics" },
      { key: "begin_order", label: "Started the order form", count: eventCount("begin_order"), source: "analytics" },
      { key: "submit_order", label: "Pressed submit", count: eventCount("submit_order"), source: "analytics" },
      { key: "orders", label: "Order requests received", count: total, source: "database" },
    ],
  };
  return { ...base, sentences: buildGrowthSentences(base) };
}

// ── Dashboard helpers ───────────────────────────────────────────────────────

export async function getOrderKpis(now: Date, timeZone: string = DEFAULT_TIME_ZONE) {
  const month = resolveGrowthPeriod("month", now, timeZone);
  const [byStatus, thisMonth, needsReview] = await Promise.all([
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.count({ where: { createdAt: { gte: month.from, lt: month.to } } }),
    db.order.count({
      where: {
        promotionId: { not: null },
        eligibilityStatus: { in: ["PRELIMINARY_ELIGIBLE", "NEEDS_REVIEW", "LIKELY_INELIGIBLE"] },
        status: { not: "CANCELLED" },
      },
    }),
  ]);
  const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  return {
    total: byStatus.reduce((sum, r) => sum + r._count._all, 0),
    new: count("NEW"),
    contacted: count("CONTACTED"),
    confirmed: count("CONFIRMED") + count("IN_PREPARATION"),
    completed: count("COMPLETED"),
    cancelled: count("CANCELLED"),
    thisMonth,
    needsReview,
  };
}
