import "server-only";
import { db } from "@/lib/db";
import { getContent } from "@/lib/content";
import { emailTransport } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { getSeoOverview, SEVERITY_ORDER, type IssueSeverity, type SeoIssue } from "@/lib/seo/quality";
import { getSitemapEntries } from "@/lib/seo/sitemap";
import type { SiteHealthCheck } from "@/generated/prisma/client";

export type HealthCategory = "seo" | "operations";

export interface HealthIssue extends SeoIssue {
  category: HealthCategory;
}

export interface HealthCheckResult {
  id: string;
  trigger: string;
  createdAt: Date;
  durationMs: number;
  issueCount: number;
  issues: HealthIssue[];
}

function op(code: string, subject: string, severity: IssueSeverity, title: string, message: string, href: string): HealthIssue {
  return { id: `${code}:${subject}`, code, severity, title, message, href, category: "operations" };
}

function hoursUntil(date: Date, now: Date) {
  return Math.max(0, Math.round((date.getTime() - now.getTime()) / 3_600_000));
}

/** Operational checks: email delivery, promotions, scheduled content, images, legal review, sitemap. */
export async function collectOperationalIssues(now: Date = new Date()): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];
  const settings = await getSettings();
  const halfHourAgo = new Date(now.getTime() - 30 * 60_000);
  const stuckBefore = new Date(now.getTime() - 15 * 60_000);
  const in48h = new Date(now.getTime() + 48 * 3_600_000);

  const [dead, failed, stuck, oldPending, endingSoon, endedEnabled, startingSoon, scheduledPosts, mealsWithoutImage, placeholderGallery, availableAreas, demoCounts] =
    await Promise.all([
      db.emailOutbox.count({ where: { status: "DEAD" } }),
      db.emailOutbox.count({ where: { status: "FAILED" } }),
      db.emailOutbox.count({ where: { status: "SENDING", lockedAt: { lt: stuckBefore } } }),
      db.emailOutbox.count({ where: { status: "PENDING", createdAt: { lt: halfHourAgo } } }),
      db.promotion.findMany({ where: { isEnabled: true, endsAt: { gt: now, lte: in48h } }, select: { id: true, name: true, endsAt: true } }),
      db.promotion.findMany({
        where: { isEnabled: true, endsAt: { lte: now, gt: new Date(now.getTime() - 30 * 86_400_000) } },
        select: { id: true, name: true },
      }),
      db.promotion.findMany({ where: { isEnabled: true, startsAt: { gt: now, lte: in48h } }, select: { id: true, name: true, startsAt: true } }),
      db.blogPost.findMany({ where: { status: "PUBLISHED", publishAt: { gt: now } }, select: { id: true, title: true, publishAt: true }, orderBy: { publishAt: "asc" } }),
      db.meal.findMany({ where: { isPublished: true, archivedAt: null, imageId: null }, select: { id: true, name: true } }),
      db.galleryItem.count({ where: { isPublished: true, mediaAsset: { isPlaceholder: true } } }),
      db.deliveryArea.count({ where: { isPublished: true, deliveryAvailable: true } }),
      Promise.all([
        db.meal.count({ where: { isDemo: true, archivedAt: null } }),
        db.plan.count({ where: { isDemo: true, archivedAt: null } }),
        db.fAQ.count({ where: { isDemo: true } }),
        db.galleryItem.count({ where: { isDemo: true } }),
      ]),
    ]);

  // Email delivery
  if (settings.contact.orderNotificationEmails.length === 0) {
    issues.push(
      op("NO_ORDER_EMAIL", "settings", "error", "No inbox receives order notifications", "Add the email address that should receive new order requests in Business settings. Orders are still saved in the admin.", "/admin/settings"),
    );
  }
  if (dead > 0) {
    issues.push(op("EMAIL_DEAD", "outbox", "error", `${dead} email${dead === 1 ? "" : "s"} could not be delivered`, "Some order emails failed repeatedly. Open the order to retry, and check your email provider settings.", "/admin/orders"));
  }
  if (failed > 0) {
    issues.push(op("EMAIL_RETRYING", "outbox", "warning", `${failed} email${failed === 1 ? " is" : "s are"} waiting to be retried`, "A temporary problem stopped some emails. They are retried automatically.", "/admin/orders"));
  }
  if (stuck > 0) {
    issues.push(op("EMAIL_STUCK", "outbox", "warning", `${stuck} email${stuck === 1 ? " is" : "s are"} stuck while sending`, "They will be picked up again automatically. If this keeps happening, check the email provider.", "/admin/orders"));
  }
  if (oldPending > 0) {
    const disabled = emailTransport() === "disabled";
    issues.push(
      op(
        "EMAIL_NOT_SENDING",
        "outbox",
        disabled ? "error" : "warning",
        `${oldPending} email${oldPending === 1 ? " hasn't" : "s haven't"} been sent yet`,
        disabled
          ? "No email provider is configured, so order emails are queued but not sent. Ask your developer to set RESEND_API_KEY and EMAIL_FROM in the hosting settings."
          : "Emails are queued but haven't gone out yet. Check that the scheduled email job is running.",
        "/admin/launch",
      ),
    );
  }

  // Promotions
  for (const p of endingSoon) {
    issues.push(op("PROMO_ENDING", p.id, "info", `“${p.name}” ends in ${hoursUntil(p.endsAt, now)} hours`, "The countdown ends automatically. Plan your next campaign if you'd like to keep momentum.", `/admin/promotions/${p.id}`));
  }
  for (const p of startingSoon) {
    issues.push(op("PROMO_STARTING", p.id, "info", `“${p.name}” starts in ${hoursUntil(p.startsAt, now)} hours`, "Check the discount, eligible plans and wording before it goes live.", `/admin/promotions/${p.id}`));
  }
  for (const p of endedEnabled) {
    issues.push(op("PROMO_ENDED", p.id, "info", `“${p.name}” has ended`, "It no longer applies to prices. Switch it off or duplicate it for your next campaign.", `/admin/promotions/${p.id}`));
  }

  // Scheduled content
  for (const post of scheduledPosts.slice(0, 5)) {
    issues.push(
      op(
        "POST_SCHEDULED",
        post.id,
        "info",
        `Scheduled: “${post.title}”`,
        `Goes live automatically in ${hoursUntil(post.publishAt!, now)} hours.`,
        `/admin/blog/${post.id}`,
      ),
    );
  }

  // Images & demo content
  for (const meal of mealsWithoutImage) {
    issues.push(op("MEAL_NO_PHOTO", meal.id, "warning", `${meal.name} has no photo`, "Meals with real photos look far more appealing. Upload one in Meals.", `/admin/meals/${meal.id}`));
  }
  if (placeholderGallery > 0) {
    issues.push(op("GALLERY_PLACEHOLDERS", "gallery", "info", `${placeholderGallery} placeholder tile${placeholderGallery === 1 ? "" : "s"} in the Instagram gallery`, "Replace them with real photos from your Instagram.", "/admin/gallery"));
  }
  const demoTotal = demoCounts.reduce((a, b) => a + b, 0);
  if (demoTotal > 0) {
    issues.push(op("DEMO_CONTENT", "demo", "info", `${demoTotal} sample item${demoTotal === 1 ? "" : "s"} still need review`, "Some meals, plans, FAQs or gallery items are still marked as samples. Review and save them (or replace them) before launch.", "/admin/launch"));
  }

  // Fulfilment
  if (settings.fulfillment.deliveryEnabled && availableAreas === 0) {
    issues.push(op("NO_DELIVERY_AREAS", "delivery", "warning", "Delivery is on, but no localities are confirmed", "Customers can't choose delivery until you confirm at least one locality — or switch delivery off.", "/admin/delivery"));
  }

  // Legal review
  const legal = await Promise.all([getContent("legal.privacy"), getContent("legal.terms"), getContent("legal.cookies")]);
  const unreviewed = legal.filter((l) => !l.reviewedByOwner).map((l) => l.title);
  if (unreviewed.length > 0) {
    issues.push(op("LEGAL_REVIEW", "legal", "warning", "Legal pages need review", `${unreviewed.join(", ")} still use the template wording. Have them reviewed, then tick “reviewed” in Homepage & pages.`, "/admin/content"));
  }

  // Sitemap
  try {
    const entries = await getSitemapEntries(now);
    if (entries.length === 0) {
      issues.push(op("SITEMAP_EMPTY", "sitemap", "error", "The sitemap is empty", "Google can't discover your pages. Check that pages are published and indexable.", "/admin/seo"));
    }
  } catch (error) {
    issues.push(op("SITEMAP_ERROR", "sitemap", "error", "The sitemap couldn't be generated", `Error: ${error instanceof Error ? error.message.slice(0, 200) : "unknown"}`, "/admin/seo"));
  }

  return issues;
}

export async function collectHealthIssues(now: Date = new Date()): Promise<HealthIssue[]> {
  const [seo, ops] = await Promise.all([
    getSeoOverview(now).then((o) => o.issues.map((i) => ({ ...i, category: "seo" as const }))),
    collectOperationalIssues(now),
  ]);
  return [...ops, ...seo].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function toResult(row: SiteHealthCheck): HealthCheckResult {
  return {
    id: row.id,
    trigger: row.trigger,
    createdAt: row.createdAt,
    durationMs: row.durationMs,
    issueCount: row.issueCount,
    issues: Array.isArray(row.issues) ? (row.issues as unknown as HealthIssue[]) : [],
  };
}

/**
 * Run every SEO and operational check and store the result. Called from the
 * admin ("Run check now") and from the weekly scheduled job.
 */
export async function runSiteHealthCheck(trigger: "manual" | "scheduled" = "manual"): Promise<HealthCheckResult> {
  const started = Date.now();
  const issues = await collectHealthIssues(new Date());
  const row = await db.siteHealthCheck.create({
    data: {
      trigger,
      issues: issues as unknown as object,
      issueCount: issues.length,
      durationMs: Date.now() - started,
    },
  });
  return toResult(row);
}

export async function getLatestHealthCheck(): Promise<HealthCheckResult | null> {
  const row = await db.siteHealthCheck.findFirst({ orderBy: { createdAt: "desc" } });
  return row ? toResult(row) : null;
}

export async function getHealthCheckHistory(limit = 12) {
  return db.siteHealthCheck.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, trigger: true, issueCount: true, durationMs: true, createdAt: true, issues: true },
  });
}

export function countBySeverity(issues: { severity: IssueSeverity }[]) {
  return {
    error: issues.filter((i) => i.severity === "error").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  };
}
