import "server-only";
import { z } from "zod";
import { fdBool, fdList, fdString } from "@/lib/actions";
import { diffObjects, logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { createSlugChangeRedirect } from "@/lib/redirects";
import { sanitizeRichText } from "@/lib/sanitize";
import { mediaIdField, optionalText, requiredText, slugField } from "./fields";

export const LANDING_TYPES = ["SEASONAL", "NEW_CUSTOMER", "PLAN", "REFERRAL", "LOCAL_AD", "CUSTOM"] as const;
export const LANDING_TYPE_LABELS: Record<(typeof LANDING_TYPES)[number], string> = {
  SEASONAL: "Seasonal campaign",
  NEW_CUSTOMER: "New customer offer",
  PLAN: "Specific plan",
  REFERRAL: "Referral promotion",
  LOCAL_AD: "Local advertising",
  CUSTOM: "Custom",
};
export const LANDING_EXPIRED = ["HIDE", "SHOW_EXPIRED_MESSAGE", "KEEP_INFO_PAGE", "REDIRECT_TO_OFFERS"] as const;
export const LANDING_EXPIRED_LABELS: Record<(typeof LANDING_EXPIRED)[number], string> = {
  HIDE: "Hide the page (shows “page not found”)",
  SHOW_EXPIRED_MESSAGE: "Show an “offer ended” message",
  KEEP_INFO_PAGE: "Keep the page as information (no discount)",
  REDIRECT_TO_OFFERS: "Send visitors to the current offers page",
};

export const landingSchema = z.object({
  type: z.enum(LANDING_TYPES),
  title: requiredText("Internal title", 100, 2),
  slug: slugField("Page address"),
  headline: requiredText("Headline", 140, 2),
  subheadline: optionalText("Subheadline", 200),
  body: z.string().max(40_000, "The page text is too long."),
  ctaText: requiredText("Button text", 50, 2),
  heroImageId: mediaIdField,
  promotionId: z
    .string()
    .trim()
    .max(40)
    .transform((v) => (v === "" ? null : v)),
  planIds: z.array(z.string().max(40)).max(20),
  utmCampaign: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9_-]*$/i, "Use letters, numbers, - and _ only.")
    .transform((v) => (v === "" ? null : v)),
  isPublished: z.boolean(),
  noindex: z.boolean(),
  expiredBehavior: z.enum(LANDING_EXPIRED),
  expiredMessage: optionalText("Ended message", 400),
  seoTitle: optionalText("SEO title", 70),
  seoDescription: optionalText("SEO description", 170),
  ogImageId: mediaIdField,
});

export type LandingInput = z.infer<typeof landingSchema>;

export function parseLandingForm(fd: FormData): LandingInput {
  const data = landingSchema.parse({
    type: fdString(fd, "type") || "SEASONAL",
    title: fdString(fd, "title"),
    slug: fdString(fd, "slug"),
    headline: fdString(fd, "headline"),
    subheadline: fdString(fd, "subheadline"),
    body: fdString(fd, "body"),
    ctaText: fdString(fd, "ctaText"),
    heroImageId: fdString(fd, "heroImageId"),
    promotionId: fdString(fd, "promotionId"),
    planIds: fdList(fd, "planIds"),
    utmCampaign: fdString(fd, "utmCampaign"),
    isPublished: fdBool(fd, "isPublished"),
    noindex: fdBool(fd, "noindex"),
    expiredBehavior: fdString(fd, "expiredBehavior") || "SHOW_EXPIRED_MESSAGE",
    expiredMessage: fdString(fd, "expiredMessage"),
    seoTitle: fdString(fd, "seoTitle"),
    seoDescription: fdString(fd, "seoDescription"),
    ogImageId: fdString(fd, "ogImageId"),
  });
  return { ...data, body: data.body ? sanitizeRichText(data.body) : "" };
}

export class LandingSlugTakenError extends Error {}

async function assertSlugFree(slug: string, exceptId?: string) {
  const existing = await db.seasonalCampaignLandingPage.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== exceptId) throw new LandingSlugTakenError("slug");
}

async function cleanRefs(input: LandingInput) {
  const planIds = input.planIds.length
    ? (await db.plan.findMany({ where: { id: { in: input.planIds } }, select: { id: true } })).map((p) => p.id)
    : [];
  const promotionId =
    input.promotionId && (await db.promotion.findUnique({ where: { id: input.promotionId }, select: { id: true } }))
      ? input.promotionId
      : null;
  return { ...input, planIds, promotionId, body: input.body || null };
}

export async function createLandingPage(actor: AuditActor, input: LandingInput) {
  await assertSlugFree(input.slug);
  const page = await db.seasonalCampaignLandingPage.create({ data: await cleanRefs(input) });
  await logAudit({
    actor,
    action: "landing.create",
    entityType: "SeasonalCampaignLandingPage",
    entityId: page.id,
    summary: `Created offer page /offers/${page.slug}`,
  });
  return page;
}

export async function updateLandingPage(actor: AuditActor, id: string, input: LandingInput, opts: { createRedirect: boolean }) {
  const before = await db.seasonalCampaignLandingPage.findUniqueOrThrow({ where: { id } });
  await assertSlugFree(input.slug, id);
  const page = await db.seasonalCampaignLandingPage.update({ where: { id }, data: await cleanRefs(input) });
  let redirect: { from: string; to: string } | null = null;
  if (before.slug !== page.slug && before.isPublished && opts.createRedirect) {
    redirect = await createSlugChangeRedirect(`/offers/${before.slug}`, `/offers/${page.slug}`, `Offer page “${page.title}” address changed`);
  }
  const { updatedAt: _a, createdAt: _b, body: bodyBefore, ...b } = before;
  const { updatedAt: _c, createdAt: _d, body: bodyAfter, ...a } = page;
  const changes = diffObjects(b, a);
  if (bodyBefore !== bodyAfter) changes.body = { from: "(previous text)", to: "(updated text)" };
  await logAudit({
    actor,
    action: "landing.update",
    entityType: "SeasonalCampaignLandingPage",
    entityId: id,
    summary: `Updated offer page /offers/${page.slug}${redirect ? ` (redirect from ${redirect.from})` : ""}`,
    changes: changes as object,
  });
  return { page, redirect };
}

export async function deleteLandingPage(actor: AuditActor, id: string) {
  const page = await db.seasonalCampaignLandingPage.delete({ where: { id } });
  await logAudit({
    actor,
    action: "landing.delete",
    entityType: "SeasonalCampaignLandingPage",
    entityId: id,
    summary: `Deleted offer page /offers/${page.slug}`,
  });
}

export async function toggleLandingPublished(actor: AuditActor, id: string) {
  const page = await db.seasonalCampaignLandingPage.findUniqueOrThrow({ where: { id } });
  const isPublished = !page.isPublished;
  await db.seasonalCampaignLandingPage.update({ where: { id }, data: { isPublished } });
  await logAudit({
    actor,
    action: isPublished ? "landing.publish" : "landing.unpublish",
    entityType: "SeasonalCampaignLandingPage",
    entityId: id,
    summary: `${isPublished ? "Published" : "Unpublished"} offer page /offers/${page.slug}`,
  });
  return isPublished;
}
