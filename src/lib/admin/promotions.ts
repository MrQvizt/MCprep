import "server-only";
import { z } from "zod";
import { fdBool, fdList, fdString } from "@/lib/actions";
import { diffObjects, logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { canonicalEmail, normalizeEmail } from "@/lib/identity";
import { normalizeCode } from "@/lib/pricing";
import { zonedLocalToUtc } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";
import { mediaIdField, moneyField, optionalNumber, optionalText, percentField, requiredText, slugField } from "./fields";

export const SEASONAL_THEMES = [
  "NONE",
  "HALLOWEEN",
  "BLACK_FRIDAY",
  "CHRISTMAS",
  "NEW_YEAR",
  "VALENTINES",
  "SUMMER_FITNESS",
  "NEW_CUSTOMER_WELCOME",
  "CUSTOM",
] as const;

export const AUDIENCES = ["ALL_CUSTOMERS", "NEW_CUSTOMERS", "SELECTED_CUSTOMERS"] as const;

const localDateTime = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, `${label}: choose a date and time.`);

const rawSchema = z.object({
  name: requiredText("Campaign name", 100, 2),
  slug: slugField("Short code"),
  theme: z.enum(SEASONAL_THEMES),
  headline: requiredText("Headline", 120, 2),
  subheadline: optionalText("Subheadline", 160),
  description: optionalText("Description", 600),
  badgeText: optionalText("Badge", 40),
  ctaText: requiredText("Button text", 40, 2),
  imageId: mediaIdField,
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FIRST_WEEK_MEAL_PRICE"]),
  discountPercent: z.string(),
  discountAmount: z.string(),
  mealPrice: z.string(),
  personalWindowMinutes: optionalNumber("Personal deadline", { int: true, min: 5, max: 7 * 24 * 60 }),
  maxDiscountCents: moneyField("Maximum discount"),
  audience: z.enum(AUDIENCES),
  requiresCode: z.boolean(),
  code: z.string().trim().max(30, "Codes can be up to 30 characters."),
  appliesToAllPlans: z.boolean(),
  planIds: z.array(z.string().max(40)).max(50),
  startsAtLocal: localDateTime("Start"),
  endsAtLocal: localDateTime("End"),
  isEnabled: z.boolean(),
  showCountdown: z.boolean(),
  showOnHomepage: z.boolean(),
  priority: optionalNumber("Priority", { int: true, min: -100, max: 100 }),
  totalRedemptionLimit: optionalNumber("Total redemption limit", { int: true, min: 1, max: 1_000_000 }),
  perCustomerLimit: optionalNumber("Per-customer limit", { int: true, min: 1, max: 100 }),
  terms: optionalText("Terms", 3000),
  expiredBehavior: z.enum(["HIDE", "SHOW_ENDED_MESSAGE"]),
  expiredMessage: optionalText("Ended message", 400),
  selectedEmails: z.string().max(20_000),
});

export interface PromotionInput {
  name: string;
  slug: string;
  theme: (typeof SEASONAL_THEMES)[number];
  headline: string;
  subheadline: string | null;
  description: string | null;
  badgeText: string | null;
  ctaText: string;
  imageId: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "FIRST_WEEK_MEAL_PRICE";
  discountValue: number;
  maxDiscountCents: number | null;
  personalWindowMinutes: number | null;
  audience: (typeof AUDIENCES)[number];
  requiresCode: boolean;
  code: string | null;
  appliesToAllPlans: boolean;
  planIds: string[];
  startsAt: Date;
  endsAt: Date;
  isEnabled: boolean;
  showCountdown: boolean;
  showOnHomepage: boolean;
  priority: number;
  totalRedemptionLimit: number | null;
  perCustomerLimit: number | null;
  terms: string | null;
  expiredBehavior: "HIDE" | "SHOW_ENDED_MESSAGE";
  expiredMessage: string | null;
  selectedEmails: string[];
}

/**
 * Validate the promotion form. Start/end are wall-clock times in the
 * business time zone (Europe/Malta by default) and are converted to UTC.
 */
export function parsePromotionForm(fd: FormData, timeZone: string): PromotionInput {
  const raw = rawSchema.parse({
    name: fdString(fd, "name"),
    slug: fdString(fd, "slug"),
    theme: fdString(fd, "theme") || "NONE",
    headline: fdString(fd, "headline"),
    subheadline: fdString(fd, "subheadline"),
    description: fdString(fd, "description"),
    badgeText: fdString(fd, "badgeText"),
    ctaText: fdString(fd, "ctaText"),
    imageId: fdString(fd, "imageId"),
    discountType: fdString(fd, "discountType"),
    discountPercent: fdString(fd, "discountPercent"),
    discountAmount: fdString(fd, "discountAmount"),
    mealPrice: fdString(fd, "mealPrice"),
    personalWindowMinutes: fdBool(fd, "personalWindowEnabled") ? fdString(fd, "personalWindowMinutes") : "",
    maxDiscountCents: fdString(fd, "maxDiscount"),
    audience: fdString(fd, "audience"),
    requiresCode: fdBool(fd, "requiresCode"),
    code: fdString(fd, "code"),
    appliesToAllPlans: fdString(fd, "planScope") !== "selected",
    planIds: fdList(fd, "planIds"),
    startsAtLocal: fdString(fd, "startsAt"),
    endsAtLocal: fdString(fd, "endsAt"),
    isEnabled: fdBool(fd, "isEnabled"),
    showCountdown: fdBool(fd, "showCountdown"),
    showOnHomepage: fdBool(fd, "showOnHomepage"),
    priority: fdString(fd, "priority"),
    totalRedemptionLimit: fdString(fd, "totalRedemptionLimit"),
    perCustomerLimit: fdString(fd, "perCustomerLimit"),
    terms: fdString(fd, "terms"),
    expiredBehavior: fdString(fd, "expiredBehavior") || "HIDE",
    expiredMessage: fdString(fd, "expiredMessage"),
    selectedEmails: fdString(fd, "selectedEmails"),
  });

  const issues: z.core.$ZodIssue[] = [];
  const issue = (path: string, message: string) =>
    issues.push({ code: "custom", path: [path], message, input: undefined } as z.core.$ZodIssue);

  let discountValue = 0;
  if (raw.discountType === "PERCENTAGE") {
    const r = percentField("Discount").safeParse(raw.discountPercent);
    if (r.success) discountValue = r.data;
    else issue("discountPercent", r.error.issues[0].message);
  } else if (raw.discountType === "FIRST_WEEK_MEAL_PRICE") {
    const r = moneyField("First-week price per meal", true).safeParse(raw.mealPrice);
    if (r.success && r.data !== null && r.data > 0) discountValue = r.data;
    else issue("mealPrice", r.success ? "Enter the first-week price per meal, e.g. 6.00." : r.error.issues[0].message);
  } else {
    const r = moneyField("Discount amount", true).safeParse(raw.discountAmount);
    if (r.success && r.data !== null && r.data > 0) discountValue = r.data;
    else issue("discountAmount", r.success ? "Discount amount must be more than €0." : r.error.issues[0].message);
  }

  const startsAt = zonedLocalToUtc(raw.startsAtLocal, timeZone);
  const endsAt = zonedLocalToUtc(raw.endsAtLocal, timeZone);
  if (!startsAt) issue("startsAt", "Choose a valid start date and time.");
  if (!endsAt) issue("endsAt", "Choose a valid end date and time.");
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) issue("endsAt", "The end must be after the start.");

  const code = normalizeCode(raw.code);
  let requiresCode = raw.requiresCode;
  if (raw.audience === "SELECTED_CUSTOMERS") requiresCode = true;
  if (requiresCode && !code) {
    issue(
      "code",
      raw.audience === "SELECTED_CUSTOMERS"
        ? "Selected-customer offers need a code that you send to those customers."
        : "Enter the code customers will type.",
    );
  }
  if (code && !/^[A-Z0-9_-]{3,30}$/.test(code)) issue("code", "Codes use letters, numbers, - and _ only (3–30 characters).");

  if (!raw.appliesToAllPlans && raw.planIds.length === 0) issue("planIds", "Choose at least one plan, or apply to all plans.");
  if (raw.expiredBehavior === "SHOW_ENDED_MESSAGE" && !raw.expiredMessage) {
    issue("expiredMessage", "Write the message shown after the offer ends.");
  }

  if (issues.length > 0) throw new z.ZodError(issues);

  const selectedEmails = raw.selectedEmails
    .split(/[\s,;]+/)
    .map((e) => normalizeEmail(e))
    .filter((e) => e.includes("@"));

  return {
    name: raw.name,
    slug: raw.slug,
    theme: raw.theme,
    headline: raw.headline,
    subheadline: raw.subheadline,
    description: raw.description,
    badgeText: raw.badgeText,
    ctaText: raw.ctaText,
    imageId: raw.imageId,
    discountType: raw.discountType,
    discountValue,
    maxDiscountCents: raw.discountType === "PERCENTAGE" ? raw.maxDiscountCents : null,
    personalWindowMinutes: raw.personalWindowMinutes,
    audience: raw.audience,
    requiresCode,
    code: requiresCode ? code : null,
    appliesToAllPlans: raw.appliesToAllPlans,
    planIds: raw.appliesToAllPlans ? [] : [...new Set(raw.planIds)],
    startsAt: startsAt!,
    endsAt: endsAt!,
    isEnabled: raw.isEnabled,
    showCountdown: raw.showCountdown,
    showOnHomepage: raw.audience === "SELECTED_CUSTOMERS" ? false : raw.showOnHomepage,
    priority: raw.priority ?? 0,
    totalRedemptionLimit: raw.totalRedemptionLimit,
    perCustomerLimit: raw.perCustomerLimit,
    terms: raw.terms,
    expiredBehavior: raw.expiredBehavior,
    expiredMessage: raw.expiredMessage,
    selectedEmails: [...new Set(selectedEmails)].slice(0, 500),
  };
}

export class PromotionConflictError extends Error {
  constructor(
    readonly field: "slug" | "code",
    message: string,
  ) {
    super(message);
  }
}

async function assertUnique(input: Pick<PromotionInput, "slug" | "code">, exceptId?: string) {
  const bySlug = await db.promotion.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (bySlug && bySlug.id !== exceptId) throw new PromotionConflictError("slug", "Another campaign already uses this web address.");
  if (input.code) {
    const byCode = await db.promotion.findUnique({ where: { code: input.code }, select: { id: true } });
    if (byCode && byCode.id !== exceptId) throw new PromotionConflictError("code", "Another campaign already uses this code.");
  }
}

function promotionData(input: PromotionInput) {
  const { planIds: _p, selectedEmails: _s, ...data } = input;
  return { ...data, isDemo: false };
}

/** Link selected customers by email. Returns emails that matched no customer. */
async function syncSelectedCustomers(tx: Prisma.TransactionClient, promotionId: string, input: PromotionInput) {
  await tx.promotionSelectedCustomer.deleteMany({ where: { promotionId } });
  if (input.audience !== "SELECTED_CUSTOMERS" || input.selectedEmails.length === 0) return [] as string[];
  const values = [...new Set(input.selectedEmails.flatMap((e) => [e, canonicalEmail(e)]))];
  const identities = await tx.customerIdentity.findMany({
    where: { type: "EMAIL", value: { in: values } },
    select: { customerId: true, value: true },
  });
  const customers = await tx.customer.findMany({ where: { email: { in: values } }, select: { id: true, email: true } });
  const matched = new Map<string, string>();
  for (const i of identities) matched.set(i.value, i.customerId);
  for (const c of customers) if (c.email) matched.set(c.email, c.id);
  const ids = new Set<string>();
  const unmatched: string[] = [];
  for (const email of input.selectedEmails) {
    const id = matched.get(email) ?? matched.get(canonicalEmail(email));
    if (id) ids.add(id);
    else unmatched.push(email);
  }
  if (ids.size > 0) {
    await tx.promotionSelectedCustomer.createMany({
      data: [...ids].map((customerId) => ({ promotionId, customerId })),
      skipDuplicates: true,
    });
  }
  return unmatched;
}

async function syncPlans(tx: Prisma.TransactionClient, promotionId: string, input: PromotionInput) {
  await tx.promotionEligiblePlan.deleteMany({ where: { promotionId } });
  if (input.appliesToAllPlans || input.planIds.length === 0) return;
  const plans = await tx.plan.findMany({ where: { id: { in: input.planIds } }, select: { id: true } });
  await tx.promotionEligiblePlan.createMany({ data: plans.map((p) => ({ promotionId, planId: p.id })) });
}

export async function createPromotion(actor: AuditActor, input: PromotionInput) {
  await assertUnique(input);
  const { promotion, unmatched } = await db.$transaction(async (tx) => {
    const promotion = await tx.promotion.create({ data: promotionData(input) });
    await syncPlans(tx, promotion.id, input);
    const unmatched = await syncSelectedCustomers(tx, promotion.id, input);
    return { promotion, unmatched };
  });
  await logAudit({
    actor,
    action: "promotion.create",
    entityType: "Promotion",
    entityId: promotion.id,
    summary: `Created campaign “${promotion.name}” (${promotion.isEnabled ? "enabled" : "disabled"})`,
  });
  return { promotion, unmatched };
}

export async function updatePromotion(actor: AuditActor, id: string, input: PromotionInput) {
  const before = await db.promotion.findUniqueOrThrow({ where: { id }, include: { eligiblePlans: true } });
  await assertUnique(input, id);
  const { promotion, unmatched } = await db.$transaction(async (tx) => {
    const promotion = await tx.promotion.update({ where: { id }, data: promotionData(input) });
    await syncPlans(tx, id, input);
    const unmatched = await syncSelectedCustomers(tx, id, input);
    return { promotion, unmatched };
  });
  const { updatedAt: _a, createdAt: _b, eligiblePlans, ...b } = before;
  const { updatedAt: _c, createdAt: _d, ...a } = promotion;
  const changes = diffObjects(
    { ...b, planIds: eligiblePlans.map((p) => p.planId).sort() },
    { ...a, planIds: input.planIds.slice().sort() },
  );
  await logAudit({
    actor,
    action: "promotion.update",
    entityType: "Promotion",
    entityId: id,
    summary: `Updated campaign “${promotion.name}”`,
    changes: changes as object,
  });
  return { promotion, unmatched };
}

export async function setPromotionEnabled(actor: AuditActor, id: string, enabled: boolean) {
  const promotion = await db.promotion.update({ where: { id }, data: { isEnabled: enabled } });
  await logAudit({
    actor,
    action: enabled ? "promotion.enable" : "promotion.disable",
    entityType: "Promotion",
    entityId: id,
    summary: `${enabled ? "Enabled" : "Disabled"} campaign “${promotion.name}”`,
  });
  return promotion;
}

/**
 * Copy a campaign for another occasion (e.g. Halloween → Black Friday).
 * The copy starts disabled with placeholder dates so nothing goes live by accident.
 */
export async function duplicatePromotion(
  actor: AuditActor,
  id: string,
  next: { name: string; slug: string; theme: (typeof SEASONAL_THEMES)[number] },
  now = new Date(),
) {
  const source = await db.promotion.findUniqueOrThrow({ where: { id }, include: { eligiblePlans: true } });
  await assertUnique({ slug: next.slug, code: null });
  const start = new Date(Math.ceil(now.getTime() / 3_600_000) * 3_600_000);
  const copy = await db.$transaction(async (tx) => {
    const created = await tx.promotion.create({
      data: {
        name: next.name,
        slug: next.slug,
        theme: next.theme,
        headline: source.headline,
        subheadline: source.subheadline,
        description: source.description,
        badgeText: null,
        ctaText: source.ctaText,
        imageId: null,
        discountType: source.discountType,
        discountValue: source.discountValue,
        maxDiscountCents: source.maxDiscountCents,
        audience: source.audience,
        requiresCode: source.requiresCode,
        code: null,
        appliesToAllPlans: source.appliesToAllPlans,
        startsAt: start,
        endsAt: new Date(start.getTime() + 72 * 3_600_000),
        isEnabled: false,
        showCountdown: source.showCountdown,
        showOnHomepage: source.showOnHomepage,
        priority: source.priority,
        totalRedemptionLimit: source.totalRedemptionLimit,
        perCustomerLimit: source.perCustomerLimit,
        terms: source.terms,
        expiredBehavior: source.expiredBehavior,
        expiredMessage: source.expiredMessage,
        isDemo: false,
      },
    });
    if (source.eligiblePlans.length > 0) {
      await tx.promotionEligiblePlan.createMany({
        data: source.eligiblePlans.map((p) => ({ promotionId: created.id, planId: p.planId })),
      });
    }
    return created;
  });
  await logAudit({
    actor,
    action: "promotion.duplicate",
    entityType: "Promotion",
    entityId: copy.id,
    summary: `Created “${copy.name}” from “${source.name}” (disabled, set dates before enabling)`,
  });
  return copy;
}

export async function deletePromotion(actor: AuditActor, id: string): Promise<"deleted" | "blocked"> {
  const promotion = await db.promotion.findUniqueOrThrow({ where: { id } });
  const [redemptions, orders, reviews] = await Promise.all([
    db.promotionRedemption.count({ where: { promotionId: id } }),
    db.order.count({ where: { promotionId: id } }),
    db.promotionEligibilityReview.count({ where: { promotionId: id } }),
  ]);
  if (redemptions + orders + reviews > 0) return "blocked";
  await db.promotion.delete({ where: { id } });
  await logAudit({ actor, action: "promotion.delete", entityType: "Promotion", entityId: id, summary: `Deleted campaign “${promotion.name}”` });
  return "deleted";
}

export interface RedemptionStats {
  requested: number;
  approved: number;
  rejected: number;
  cancelled: number;
  orders: number;
}

export async function redemptionStats(promotionIds: string[]): Promise<Map<string, RedemptionStats>> {
  const out = new Map<string, RedemptionStats>();
  for (const id of promotionIds) out.set(id, { requested: 0, approved: 0, rejected: 0, cancelled: 0, orders: 0 });
  if (promotionIds.length === 0) return out;
  const [rows, orders] = await Promise.all([
    db.promotionRedemption.groupBy({
      by: ["promotionId", "status"],
      where: { promotionId: { in: promotionIds } },
      _count: { _all: true },
    }),
    db.order.groupBy({ by: ["promotionId"], where: { promotionId: { in: promotionIds } }, _count: { _all: true } }),
  ]);
  for (const r of rows) {
    const s = out.get(r.promotionId)!;
    const key = r.status.toLowerCase() as keyof RedemptionStats;
    s[key] = r._count._all;
  }
  for (const o of orders) if (o.promotionId) out.get(o.promotionId)!.orders = o._count._all;
  return out;
}
