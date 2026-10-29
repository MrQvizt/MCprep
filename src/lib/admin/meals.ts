import "server-only";
import { z } from "zod";
import { fdBool, fdList, fdString } from "@/lib/actions";
import { nextSortOrder } from "@/lib/admin/reorder";
import { diffObjects, logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { createSlugChangeRedirect } from "@/lib/redirects";
import { mediaIdField, optionalNumber, optionalText, requiredText, slugField, splitList } from "./fields";

/** The 14 allergens that must be declared under EU Regulation 1169/2011. */
export const EU_ALLERGENS = [
  "Cereals containing gluten",
  "Crustaceans",
  "Eggs",
  "Fish",
  "Peanuts",
  "Soybeans",
  "Milk",
  "Nuts",
  "Celery",
  "Mustard",
  "Sesame seeds",
  "Sulphur dioxide and sulphites",
  "Lupin",
  "Molluscs",
] as const;

export const mealSchema = z.object({
  name: requiredText("Meal name", 120, 2),
  slug: slugField(),
  shortDescription: optionalText("Short description", 300),
  description: optionalText("Description", 4000),
  imageId: mediaIdField,
  extraImageIds: z.array(z.string().max(40)).max(12),
  calories: optionalNumber("Calories", { int: true, min: 0, max: 5000 }),
  proteinG: optionalNumber("Protein", { min: 0, max: 500 }),
  carbsG: optionalNumber("Carbohydrates", { min: 0, max: 500 }),
  fatG: optionalNumber("Fat", { min: 0, max: 500 }),
  servingSize: optionalText("Serving size", 80),
  ingredients: optionalText("Ingredients", 2000),
  nutritionSource: optionalText("Nutrition source", 500),
  nutritionVerified: z.boolean(),
  dietaryTags: z.array(z.string().max(40)).max(20),
  allergens: z.array(z.enum(EU_ALLERGENS)).max(14),
  label: optionalText("Label", 30),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  seoTitle: optionalText("SEO title", 70),
  seoDescription: optionalText("SEO description", 170),
});

export type MealInput = z.infer<typeof mealSchema>;

export function parseMealForm(fd: FormData) {
  return mealSchema.parse({
    name: fdString(fd, "name"),
    slug: fdString(fd, "slug"),
    shortDescription: fdString(fd, "shortDescription"),
    description: fdString(fd, "description"),
    imageId: fdString(fd, "imageId"),
    extraImageIds: fdList(fd, "extraImageIds"),
    calories: fdString(fd, "calories"),
    proteinG: fdString(fd, "proteinG"),
    carbsG: fdString(fd, "carbsG"),
    fatG: fdString(fd, "fatG"),
    servingSize: fdString(fd, "servingSize"),
    ingredients: fdString(fd, "ingredients"),
    nutritionSource: fdString(fd, "nutritionSource"),
    nutritionVerified: fdBool(fd, "nutritionVerified"),
    dietaryTags: splitList(fdString(fd, "dietaryTags"), 20),
    allergens: fdList(fd, "allergens"),
    label: fdString(fd, "label"),
    isFeatured: fdBool(fd, "isFeatured"),
    isPublished: fdBool(fd, "isPublished"),
    seoTitle: fdString(fd, "seoTitle"),
    seoDescription: fdString(fd, "seoDescription"),
  });
}

class SlugTakenError extends Error {
  code = "SLUG_TAKEN";
}

async function assertSlugFree(slug: string, exceptId?: string) {
  const existing = await db.meal.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== exceptId) throw new SlugTakenError("slug");
}

export function isSlugTaken(error: unknown) {
  return error instanceof SlugTakenError;
}

function mealData(input: MealInput) {
  const { extraImageIds: _extra, ...rest } = input;
  return { ...rest, isDemo: false };
}

async function replaceImages(mealId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const existing = unique.length
    ? await db.mediaAsset.findMany({ where: { id: { in: unique } }, select: { id: true } })
    : [];
  const valid = new Set(existing.map((m) => m.id));
  await db.$transaction([
    db.mealImage.deleteMany({ where: { mealId } }),
    db.mealImage.createMany({
      data: unique.filter((id) => valid.has(id)).map((mediaAssetId, i) => ({ mealId, mediaAssetId, sortOrder: i })),
    }),
  ]);
}

export async function createMeal(actor: AuditActor, input: MealInput) {
  await assertSlugFree(input.slug);
  const meal = await db.meal.create({ data: { ...mealData(input), sortOrder: await nextSortOrder("meal") } });
  await replaceImages(meal.id, input.extraImageIds);
  await logAudit({ actor, action: "meal.create", entityType: "Meal", entityId: meal.id, summary: `Created meal “${meal.name}”` });
  return meal;
}

export async function updateMeal(actor: AuditActor, id: string, input: MealInput, opts: { createRedirect: boolean }) {
  const before = await db.meal.findUniqueOrThrow({ where: { id } });
  await assertSlugFree(input.slug, id);
  const meal = await db.meal.update({ where: { id }, data: mealData(input) });
  await replaceImages(id, input.extraImageIds);

  let redirect: { from: string; to: string } | null = null;
  if (before.slug !== meal.slug && before.isPublished && !before.archivedAt && opts.createRedirect) {
    redirect = await createSlugChangeRedirect(`/menu/${before.slug}`, `/menu/${meal.slug}`, `Meal “${meal.name}” address changed`);
  }
  const { updatedAt: _a, createdAt: _b, ...b } = before;
  const { updatedAt: _c, createdAt: _d, ...a } = meal;
  await logAudit({
    actor,
    action: "meal.update",
    entityType: "Meal",
    entityId: id,
    summary: `Updated meal “${meal.name}”${redirect ? ` (redirect ${redirect.from} → ${redirect.to})` : ""}`,
    changes: diffObjects(b, a) as object,
  });
  return { meal, redirect };
}

export async function setMealArchived(actor: AuditActor, id: string, archived: boolean) {
  const meal = await db.meal.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await logAudit({
    actor,
    action: archived ? "meal.archive" : "meal.unarchive",
    entityType: "Meal",
    entityId: id,
    summary: `${archived ? "Archived" : "Restored"} meal “${meal.name}”`,
  });
  return meal;
}

export async function deleteMeal(actor: AuditActor, id: string) {
  const meal = await db.meal.delete({ where: { id } });
  await logAudit({ actor, action: "meal.delete", entityType: "Meal", entityId: id, summary: `Deleted meal “${meal.name}”` });
  return meal;
}

export async function toggleMealFlag(actor: AuditActor, id: string, flag: "isPublished" | "isFeatured") {
  const meal = await db.meal.findUniqueOrThrow({ where: { id } });
  const value = !meal[flag];
  await db.meal.update({ where: { id }, data: { [flag]: value } });
  const label = flag === "isPublished" ? (value ? "Published" : "Hid") : value ? "Featured" : "Un-featured";
  await logAudit({ actor, action: `meal.${flag}`, entityType: "Meal", entityId: id, summary: `${label} meal “${meal.name}”` });
  return value;
}
