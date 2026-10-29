import { z } from "zod";
import { db } from "@/lib/db";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFrom, deviceFromUserAgent, isBotUserAgent } from "@/lib/request";
import { getSettings } from "@/lib/settings";

const slug = z.string().max(120).regex(/^[a-z0-9-]*$/).optional();
const short = z.string().max(120).optional();

const eventSchema = z.object({
  name: z.enum(ANALYTICS_EVENTS),
  path: z.string().max(300).regex(/^\//).optional(),
  referrerHost: z.string().max(200).regex(/^[a-z0-9.-]*$/i).optional(),
  utmSource: short,
  utmMedium: short,
  utmCampaign: short,
  planSlug: slug,
  mealSlug: slug,
  promotionSlug: slug,
});

/**
 * First-party, cookieless analytics endpoint. Stores no IP address, no
 * cookies and no personal data — only the event name, page and campaign tags.
 */
export async function POST(request: Request) {
  const ua = request.headers.get("user-agent");
  if (isBotUserAgent(ua)) return new Response(null, { status: 204 });

  const settings = await getSettings();
  if (!settings.tracking.firstPartyAnalyticsEnabled) return new Response(null, { status: 204 });

  const limited = await rateLimit(`events:${clientIpFrom(request.headers)}`, 120, 60);
  if (!limited.ok) return new Response(null, { status: 429 });

  let json: unknown;
  try {
    const text = await request.text();
    if (text.length > 4000) return new Response(null, { status: 413 });
    json = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });
  const e = parsed.data;
  if (e.path?.startsWith("/admin")) return new Response(null, { status: 204 });

  await db.analyticsEvent.create({
    data: {
      name: e.name,
      path: e.path?.split("?")[0] ?? null,
      referrerHost: e.referrerHost ?? null,
      utmSource: e.utmSource ?? null,
      utmMedium: e.utmMedium ?? null,
      utmCampaign: e.utmCampaign ?? null,
      planSlug: e.planSlug ?? null,
      mealSlug: e.mealSlug ?? null,
      promotionSlug: e.promotionSlug ?? null,
      device: deviceFromUserAgent(ua),
    },
  });
  return new Response(null, { status: 204 });
}
