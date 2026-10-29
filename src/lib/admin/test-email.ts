import "server-only";
import { logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { enqueueEmails, processOutbox, type ProcessResult } from "@/lib/email/outbox";
import { renderTestEmail } from "@/lib/email/templates";
import type { EmailTransport } from "@/lib/email/transport";
import { siteUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/whatsapp";

/** Where order notifications go: configured notification addresses, else the public email. */
export function notificationRecipients(contact: { orderNotificationEmails: string[]; publicEmail: string }): string[] {
  if (contact.orderNotificationEmails.length > 0) return contact.orderNotificationEmails;
  return contact.publicEmail ? [contact.publicEmail] : [];
}

export interface TestEmailResult {
  recipients: string[];
  queued: number;
  result: ProcessResult;
  errors: string[];
}

/**
 * Queue a test email to the order-notification addresses and try to send it
 * straight away through the normal outbox (so it proves the real path works).
 */
export async function sendTestEmail(actor: AuditActor, opts: { transport?: EmailTransport | null; now?: Date } = {}): Promise<TestEmailResult> {
  const settings = await getSettings();
  const recipients = notificationRecipients(settings.contact);
  if (recipients.length === 0) {
    return { recipients, queued: 0, result: { claimed: 0, sent: 0, failed: 0, dead: 0 }, errors: ["NO_RECIPIENTS"] };
  }
  const rendered = renderTestEmail({
    tradingName: settings.business.tradingName,
    timeZone: settings.business.timeZone,
    publicEmail: settings.contact.publicEmail,
    phone: settings.contact.phone,
    whatsappLink: whatsappLink(settings.contact.whatsappNumber),
    instagramUrl: settings.contact.instagramUrl,
    siteUrl: siteUrl(),
  });
  const stamp = (opts.now ?? new Date()).getTime();
  const dedupeKeys = recipients.map((to) => `test:${stamp}:${to}`);
  const queued = await enqueueEmails(
    db,
    recipients.map((to, i) => ({
      type: "TEST" as const,
      dedupeKey: dedupeKeys[i],
      to,
      replyTo: settings.contact.replyToEmail || null,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })),
  );
  const rows = await db.emailOutbox.findMany({ where: { dedupeKey: { in: dedupeKeys } }, select: { id: true } });
  const result = await processOutbox({ ids: rows.map((r) => r.id), transport: opts.transport });
  const failed = await db.emailOutbox.findMany({
    where: { id: { in: rows.map((r) => r.id) }, status: { in: ["FAILED", "DEAD"] } },
    select: { lastError: true },
  });
  await logAudit({
    actor,
    action: "email.test",
    entityType: "EmailOutbox",
    summary: `Sent a test email to ${recipients.join(", ")}`,
    changes: { sent: result.sent, failed: result.failed + result.dead, skipped: result.skipped ?? null },
  });
  return { recipients, queued, result, errors: failed.map((f) => f.lastError ?? "Unknown error") };
}
