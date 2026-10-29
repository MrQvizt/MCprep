import { describe, expect, it } from "vitest";
import { saveMeal, toggleMeal } from "@/app/admin/(dashboard)/meals/actions";
import { createMeal, parseMealForm, updateMeal } from "@/lib/admin/meals";
import { db } from "@/lib/db";
import { form, initial, runAction } from "./admin-form-utils";
import { signInAs } from "./helpers";

const base = {
  name: "Chicken Pokébowl",
  slug: "chicken-pokebowl",
  shortDescription: "A macro-counted bowl.",
  calories: "544",
  proteinG: "45",
  carbsG: "63",
  fatG: "7",
  isPublished: true,
  isFeatured: true,
};

describe("admin meals", () => {
  it("creates a meal with optional nutrition left blank and allergens validated", async () => {
    const admin = await signInAs("EDITOR");
    const meal = await createMeal(admin, parseMealForm(form({ ...base, fatG: "", allergens: ["Milk", "Sesame seeds"] })));
    expect(meal).toMatchObject({ calories: 544, proteinG: 45, fatG: null, allergens: ["Milk", "Sesame seeds"], isDemo: false });
    expect(() => parseMealForm(form({ ...base, allergens: ["Unicorn"] }))).toThrow();
    expect(() => parseMealForm(form({ ...base, calories: "lots" }))).toThrow(/Calories must be a number/);
    const log = await db.auditLog.findFirst({ where: { action: "meal.create", entityId: meal.id } });
    expect(log?.actorEmail).toBe(admin.email);
  });

  it("offers a redirect when a published meal's address changes", async () => {
    const admin = await signInAs("OWNER");
    const meal = await createMeal(admin, parseMealForm(form(base)));
    const { redirect } = await updateMeal(admin, meal.id, parseMealForm(form({ ...base, slug: "chicken-poke-bowl" })), { createRedirect: true });
    expect(redirect).toEqual({ from: "/menu/chicken-pokebowl", to: "/menu/chicken-poke-bowl" });
    const rule = await db.redirectRule.findUnique({ where: { fromPath: "/menu/chicken-pokebowl" } });
    expect(rule).toMatchObject({ toPath: "/menu/chicken-poke-bowl", statusCode: 301 });

    // No redirect when the owner opts out.
    const r2 = await updateMeal(admin, meal.id, parseMealForm(form({ ...base, slug: "poke-bowl" })), { createRedirect: false });
    expect(r2.redirect).toBeNull();
  });

  it("does not create redirects for hidden meals", async () => {
    const admin = await signInAs("OWNER");
    const meal = await createMeal(admin, parseMealForm(form({ ...base, isPublished: false })));
    const { redirect } = await updateMeal(admin, meal.id, parseMealForm(form({ ...base, isPublished: false, slug: "new-slug" })), { createRedirect: true });
    expect(redirect).toBeNull();
    expect(await db.redirectRule.count()).toBe(0);
  });

  it("saves via the server action, reports duplicate slugs and clears the demo flag", async () => {
    await signInAs("EDITOR");
    const created = await runAction(() => saveMeal(null, initial, form(base)));
    expect(created.redirectTo).toMatch(/^\/admin\/meals\//);
    const dup = await runAction(() => saveMeal(null, initial, form({ ...base, name: "Other" })));
    expect(dup.result?.ok).toBe(false);
    expect(dup.result?.fieldErrors?.slug).toMatch(/already uses/);

    const demo = await db.meal.create({ data: { name: "Demo", slug: "demo", isDemo: true } });
    const saved = await saveMeal(demo.id, initial, form({ ...base, name: "Demo", slug: "demo" }));
    expect(saved.ok).toBe(true);
    expect((await db.meal.findUniqueOrThrow({ where: { id: demo.id } })).isDemo).toBe(false);

    const toggled = await toggleMeal(demo.id, "isFeatured");
    expect(toggled.ok).toBe(true);
  });

  it("blocks signed-out users", async () => {
    const res = await saveMeal(null, initial, form(base));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/session has expired/i);
    expect(await db.meal.count()).toBe(0);
  });
});
