import "server-only";
import { db } from "@/lib/db";
import { hashValue } from "@/lib/request";

export interface RateLimitResult {
  ok: boolean;
  count: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across
 * serverless instances. Keys are hashed (no raw IPs/emails stored).
 */
export async function rateLimit(rawKey: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const key = `${rawKey.split(":")[0]}:${hashValue(rawKey)}`;
  try {
    const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + (${windowSeconds}::int * interval '1 second'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now()
          THEN now() + (${windowSeconds}::int * interval '1 second')
          ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"`;
    const row = rows[0];
    const count = Number(row.count);
    return { ok: count <= limit, count, remaining: Math.max(0, limit - count), resetAt: row.resetAt };
  } catch (error) {
    // Fail open: a rate-limit storage problem must not take the site down.
    console.error("[rate-limit] error", error);
    return { ok: true, count: 0, remaining: limit, resetAt: new Date() };
  }
}

export async function resetRateLimit(rawKey: string) {
  const key = `${rawKey.split(":")[0]}:${hashValue(rawKey)}`;
  await db.rateLimit.deleteMany({ where: { key } });
}

export async function purgeExpiredRateLimits() {
  const { count } = await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return count;
}
