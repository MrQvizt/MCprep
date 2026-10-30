import "server-only";
import { z } from "zod";
import { fdBool, fdString } from "@/lib/actions";
import { nextSortOrder } from "@/lib/admin/reorder";
import { diffObjects, logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { moneyField, optionalNumber, optionalText, requiredInt, requiredText, slugField, splitLines } from "./fields";

export const planSchema = z.object({
  name: requiredText("Plan name", 60, 2),
  slug: slugField("Short code"),
  tagline: optionalText("Tagline", 40),
  description: optionalText("Description", 400),
  durationDays: requiredInt("Duration (days)", 1, 365),
  mealsIncluded: optionalNumber("Meals included", { int: true, min: 1, max: 500 }),
  features: z.array(z.string().max(120, "Each inclusion must be 120 characters or fewer.")).max(12, "Up to 12 inclusions."),
  priceCents: moneyField("Price"),
  savingsLabel: optionalText("Savings label", 40),
  isRecommended: z.boolean(),
  isActive: z.boolean(),
  mealsPerDay: z.union([z.literal(1), z.literal(2)]).nullable(),
  daysPerWeek: optionalNumber("Days per week", { int: true, min: 1, max: 7 }),
  isSubscription: z.boolean(),
}).superRefine((v, ctx) => {
  if (v.mealsPerDay && !v.daysPerWeek) {
    ctx.addIssue({ code: "custom", path: ["daysPerWeek"], message: "Packages need the number of days per week." });
  }
  if (v.mealsPerDay && v.daysPerWeek && v.mealsIncluded && v.mealsIncluded % (v.mealsPerDay * v.daysPerWeek) !== 0) {
    ctx.addIssue({
      code: "custom",
      path: ["mealsIncluded"],
      message: `Meals included should be a multiple of ${v.mealsPerDay * v.daysPerWeek} (meals per week).`,
    });
  }
});

export type PlanInput = z.infer<typeof planSchema>;

export function parsePlanForm(fd: FormData) {
  return planSchema.parse({
    name: fdString(fd, "name"),
    slug: fdString(fd, "slug"),
    tagline: fdString(fd, "tagline"),
    description: fdString(fd, "description"),
    durationDays: fdString(fd, "durationDays"),
    mealsIncluded: fdString(fd, "mealsIncluded"),
    features: splitLines(fdString(fd, "features"), 12),
    priceCents: fdString(fd, "price"),
    savingsLabel: fdString(fd, "savingsLabel"),
    isRecommended: fdBool(fd, "isRecommended"),
    isActive: fdBool(fd, "isActive"),
    mealsPerDay: (() => {
      const v = fdString(fd, "mealsPerDay");
      return v === "1" ? 1 : v === "2" ? 2 : null;
    })(),
    daysPerWeek: fdString(fd, "mealsPerDay") ? fdString(fd, "daysPerWeek") : "",
    isSubscription: fdBool(fd, "isSubscription"),
  });
}

export class PlanSlugTakenError extends Error {}

async function assertSlugFree(slug: string, exceptId?: string) {
  const existing = await db.plan.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== exceptId) throw new PlanSlugTakenError("slug");
}

const priceLabel = (cents: number | null) => (cents === null ? "price on request" : formatMoney(cents));

export async function createPlan(actor: AuditActor, input: PlanInput) {
  await assertSlugFree(input.slug);
  const plan = await db.$transaction(async (tx) => {
    if (input.isRecommended) await tx.plan.updateMany({ where: { isRecommended: true }, data: { isRecommended: false } });
    return tx.plan.create({ data: { ...input, isDemo: false, sortOrder: await nextSortOrder("plan") } });
  });
  await logAudit({
    actor,
    action: "plan.create",
    entityType: "Plan",
    entityId: plan.id,
    summary: `Created plan “${plan.name}” at ${priceLabel(plan.priceCents)}`,
  });
  return plan;
}

/**
 * Update a plan. Orders store their own pricing snapshot, so changing the
 * price here never changes what existing customers were quoted.
 */
export async function updatePlan(actor: AuditActor, id: string, input: PlanInput) {
  const before = await db.plan.findUniqueOrThrow({ where: { id } });
  await assertSlugFree(input.slug, id);
  const plan = await db.$transaction(async (tx) => {
    if (input.isRecommended) {
      await tx.plan.updateMany({ where: { isRecommended: true, id: { not: id } }, data: { isRecommended: false } });
    }
    return tx.plan.update({ where: { id }, data: { ...input, isDemo: false } });
  });
  const priceChanged = before.priceCents !== plan.priceCents;
  if (priceChanged) {
    await logAudit({
      actor,
      action: "plan.price_change",
      entityType: "Plan",
      entityId: id,
      summary: `Changed “${plan.name}” price from ${priceLabel(before.priceCents)} to ${priceLabel(plan.priceCents)}`,
      changes: { priceCents: { from: before.priceCents, to: plan.priceCents } },
    });
  }
  const { updatedAt: _a, createdAt: _b, ...b } = before;
  const { updatedAt: _c, createdAt: _d, ...a } = plan;
  const changes = diffObjects(b, a);
  delete changes.priceCents;
  if (Object.keys(changes).length > 0) {
    await logAudit({ actor, action: "plan.update", entityType: "Plan", entityId: id, summary: `Updated plan “${plan.name}”`, changes: changes as object });
  }
  return plan;
}

/** Hard-delete only plans that no order references; otherwise archive. */
export async function deleteOrArchivePlan(actor: AuditActor, id: string): Promise<"deleted" | "archived"> {
  const plan = await db.plan.findUniqueOrThrow({ where: { id } });
  const orderCount = await db.order.count({ where: { planId: id } });
  if (orderCount > 0) {
    await db.plan.update({ where: { id }, data: { archivedAt: new Date(), isActive: false, isRecommended: false } });
    await logAudit({
      actor,
      action: "plan.archive",
      entityType: "Plan",
      entityId: id,
      summary: `Archived plan “${plan.name}” (${orderCount} order(s) reference it)`,
    });
    return "archived";
  }
  await db.plan.delete({ where: { id } });
  await logAudit({ actor, action: "plan.delete", entityType: "Plan", entityId: id, summary: `Deleted plan “${plan.name}”` });
  return "deleted";
}

export async function setPlanArchived(actor: AuditActor, id: string, archived: boolean) {
  const plan = await db.plan.update({
    where: { id },
    data: archived ? { archivedAt: new Date(), isActive: false, isRecommended: false } : { archivedAt: null },
  });
  await logAudit({
    actor,
    action: archived ? "plan.archive" : "plan.unarchive",
    entityType: "Plan",
    entityId: id,
    summary: `${archived ? "Archived" : "Restored"} plan “${plan.name}”`,
  });
  return plan;
}

export async function togglePlanActive(actor: AuditActor, id: string) {
  const plan = await db.plan.findUniqueOrThrow({ where: { id } });
  const isActive = !plan.isActive;
  await db.plan.update({ where: { id }, data: { isActive } });
  await logAudit({
    actor,
    action: isActive ? "plan.enable" : "plan.disable",
    entityType: "Plan",
    entityId: id,
    summary: `${isActive ? "Enabled" : "Disabled"} plan “${plan.name}”`,
  });
  return isActive;
}

export async function setRecommendedPlan(actor: AuditActor, id: string) {
  const plan = await db.$transaction(async (tx) => {
    await tx.plan.updateMany({ where: { isRecommended: true }, data: { isRecommended: false } });
    return tx.plan.update({ where: { id }, data: { isRecommended: true } });
  });
  await logAudit({ actor, action: "plan.recommend", entityType: "Plan", entityId: id, summary: `Marked “${plan.name}” as recommended` });
}
