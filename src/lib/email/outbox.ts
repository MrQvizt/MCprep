import "server-only";
import { db } from "@/lib/db";
import type { EmailType, Prisma } from "@/generated/prisma/client";
import { EmailDeliveryError, getTransport, type EmailTransport } from "./transport";

import { nextAttemptDelayMs } from "./outbox-backoff";

export { nextAttemptDelayMs, RETRY_BACKOFF_MINUTES } from "./outbox-backoff";

export interface EnqueueEmailInput {
  type: EmailType;
  dedupeKey: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  orderId?: string | null;
}

type Tx = Prisma.TransactionClient | typeof db;

/**
 * Add emails to the outbox (inside the caller's transaction). Duplicate
 * dedupe keys are ignored, so retries of the same order never double-send.
 */
export async function enqueueEmails(tx: Tx, emails: EnqueueEmailInput[]) {
  if (emails.length === 0) return 0;
  const result = await tx.emailOutbox.createMany({
    data: emails.map((e) => ({
      type: e.type,
      dedupeKey: e.dedupeKey,
      toAddress: e.to,
      replyTo: e.replyTo ?? null,
      subject: e.subject,
      html: e.html,
      text: e.text,
      orderId: e.orderId ?? null,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

interface ClaimedRow {
  id: string;
  toAddress: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  attempts: number;
  maxAttempts: number;
}

/** Atomically claim due emails (safe under concurrent workers). */
async function claimDue(limit: number, ids?: string[]): Promise<ClaimedRow[]> {
  const idFilter = ids && ids.length > 0 ? ids : null;
  return db.$queryRaw<ClaimedRow[]>`
    UPDATE "EmailOutbox"
    SET "status" = 'SENDING', "lockedAt" = now(), "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "EmailOutbox"
      WHERE (
        ("status" IN ('PENDING', 'FAILED') AND "nextAttemptAt" <= now())
        OR ("status" = 'SENDING' AND "lockedAt" < now() - interval '10 minutes')
      )
      AND (${idFilter}::text[] IS NULL OR "id" = ANY(${idFilter}::text[]))
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "toAddress", "replyTo", "subject", "html", "text", "attempts", "maxAttempts"`;
}

export interface ProcessResult {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
  skipped?: "disabled";
}

/**
 * Send due emails. Called right after an order is saved (best effort), by the
 * cron endpoint, and from the admin "retry" button. A failure never affects
 * the saved order; the email simply stays in the outbox for the next attempt.
 */
export async function processOutbox(
  opts: { limit?: number; ids?: string[]; transport?: EmailTransport | null } = {},
): Promise<ProcessResult> {
  const transport = opts.transport === undefined ? getTransport() : opts.transport;
  if (!transport) return { claimed: 0, sent: 0, failed: 0, dead: 0, skipped: "disabled" };

  const rows = await claimDue(opts.limit ?? 20, opts.ids);
  const result: ProcessResult = { claimed: rows.length, sent: 0, failed: 0, dead: 0 };

  for (const row of rows) {
    try {
      const delivery = await transport({
        id: row.id,
        to: row.toAddress,
        replyTo: row.replyTo,
        subject: row.subject,
        html: row.html,
        text: row.text,
      });
      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lockedAt: null,
          lastError: null,
          provider: delivery.provider,
          providerMessageId: delivery.messageId,
        },
      });
      result.sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const permanent = error instanceof EmailDeliveryError && error.permanent;
      const giveUp = permanent || row.attempts >= row.maxAttempts;
      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: giveUp ? "DEAD" : "FAILED",
          lockedAt: null,
          lastError: message.slice(0, 1000),
          nextAttemptAt: new Date(Date.now() + nextAttemptDelayMs(row.attempts)),
        },
      });
      if (giveUp) result.dead++;
      else result.failed++;
      console.error(`[email] delivery failed for ${row.id} (attempt ${row.attempts})`, message);
    }
  }
  return result;
}

/** Admin action: put a failed/dead email back in the queue for immediate retry. */
export async function requeueEmail(id: string) {
  await db.emailOutbox.update({
    where: { id },
    data: { status: "PENDING", nextAttemptAt: new Date(), lockedAt: null, maxAttempts: { increment: 3 } },
  });
}
