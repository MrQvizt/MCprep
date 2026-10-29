import { isAuthorizedCron, unauthorized } from "@/lib/cron";
import { processOutbox } from "@/lib/email/outbox";

export const dynamic = "force-dynamic";

/** Sends queued/retryable emails. Schedule every 5–15 minutes where your host allows. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return unauthorized();
  const result = await processOutbox({ limit: 50 });
  return Response.json({ ok: true, ...result });
}
