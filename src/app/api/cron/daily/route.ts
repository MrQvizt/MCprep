import { isAuthorizedCron, unauthorized } from "@/lib/cron";
import { db } from "@/lib/db";
import { processOutbox } from "@/lib/email/outbox";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Analytics events older than this are deleted (data minimisation). */
const ANALYTICS_RETENTION_DAYS = 400;

/**
 * Daily maintenance: send any queued emails, clean up expired rate-limit
 * counters and old anonymous analytics events, and run the site health check.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return unauthorized();
  const started = Date.now();
  const outbox = await processOutbox({ limit: 100 });
  const rateLimits = await purgeExpiredRateLimits();
  const cutoff = new Date(Date.now() - ANALYTICS_RETENTION_DAYS * 86_400_000);
  const { count: analyticsPurged } = await db.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });

  let health: { issueCount: number } | { error: string } | null = null;
  try {
    const { runSiteHealthCheck } = await import("@/lib/site-health");
    const check = await runSiteHealthCheck("scheduled");
    health = { issueCount: check.issueCount };
  } catch (error) {
    health = { error: error instanceof Error ? error.message : "health check failed" };
  }

  return Response.json({ ok: true, outbox, rateLimits, analyticsPurged, health, durationMs: Date.now() - started });
}
