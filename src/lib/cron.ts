import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Scheduled endpoints require `Authorization: Bearer <CRON_SECRET>`
 * (Vercel Cron sends this automatically when CRON_SECRET is set).
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
