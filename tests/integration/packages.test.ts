import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { orderRequestSchema, type OrderRequestInput } from "@/lib/orders/schema";
import { createOrderRequest, OrderValidationError, quoteForOrder } from "@/lib/orders/service";
import { applyReleases } from "../../prisma/releases";

const NOW = new Date();
const MIN = 60_000;

async function setup() {
  await applyReleases(db, () => {});
  const meals = await db.meal.findMany({ where: { isPublished: true }, orderBy: { sortOrder: "asc" } });
  return { meals };
}

function input(overrides: Partial<OrderRequestInput> = {}) {
  return orderRequestSchema.parse({
    idempotencyKey: randomUUID(),
    planSlug: "lunch-dinner-5-days",
    fullName: "Maria Borg",
    email: "maria.borg@example.com",
    phone: "7912 3456",
    fulfillmentMethod: "COLLECTION",
    privacyAccepted: true,
    firstOrderDeclared: false,
    allergyConsent: false,
    marketingOptIn: false,
    ...overrides,
  });
}

async function fieldErrors(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(OrderValidationError);
  return (error as OrderValidationError).fieldErrors;
}

describe("content release", () => {
  it("creates the menu, the six packages and the €6 offer once, and retires placeholder plans", async () => {
    await db.plan.create({ data: { slug: "2-weeks", name: "2 Weeks", durationDays: 14, priceCents: null } });
    await db.plan.create({ data: { slug: "1-month", name: "1 Month", durationDays: 28, priceCents: 22000 } }); // priced → kept
    const first = await applyReleases(db, () => {});
    const again = await applyReleases(db, () => {});
    expect(first).toHaveLength(1);
    expect(again).toHaveLength(0);

    const packages = await db.plan.findMany({ where: { mealsPerDay: { not: null } }, orderBy: { sortOrder: "asc" } });
    expect(packages.map((p) => [p.slug, p.priceCents, p.mealsIncluded])).toEqual([
      ["lunch-5-days", 5250, 5],
      ["lunch-7-days", 7000, 7],
      ["lunch-dinner-5-days", 9500, 10],
      ["lunch-dinner-7-days", 11900, 14],
      ["monthly-lunch-dinner-5-days", 36000, 40],
      ["monthly-lunch-dinner-7-days", 45000, 56],
    ]);
    expect(await db.plan.findUniqueOrThrow({ where: { slug: "2-weeks" } })).toMatchObject({ isActive: false });
    expect(await db.plan.findUniqueOrThrow({ where: { slug: "1-month" } })).toMatchObject({ isActive: true });
    const meals = await db.meal.findMany({ include: { image: true }, orderBy: { sortOrder: "asc" } });
    expect(meals).toHaveLength(5);
    expect(meals.every((m) => m.image?.url.startsWith("/images/menu/"))).toBe(true);
    expect(await db.promotion.findUniqueOrThrow({ where: { slug: "first-week-6-euro" } })).toMatchObject({
      discountType: "FIRST_WEEK_MEAL_PRICE",
      discountValue: 600,
      personalWindowMinutes: 120,
      isEnabled: true,
    });
  });

  it("doesn't overwrite admin edits on later runs", async () => {
    await applyReleases(db, () => {});
    await db.plan.update({ where: { slug: "lunch-5-days" }, data: { priceCents: 5500 } });
    await applyReleases(db, () => {});
    expect((await db.plan.findUniqueOrThrow({ where: { slug: "lunch-5-days" } })).priceCents).toBe(5500);
  });
});

describe("package orders", () => {
  it("saves the dishes chosen per week with the package snapshot", async () => {
    const { meals } = await setup();
    const result = await createOrderRequest(
      input({
        mealSelections: [
          { mealId: meals[0].id, quantity: 4 },
          { mealId: meals[2].id, quantity: 6 },
        ],
      }),
      { now: NOW },
    );
    const order = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { mealSelections: { orderBy: { sortOrder: "asc" } }, emails: true },
    });
    expect(order).toMatchObject({ planMealsPerWeek: 10, planIsSubscription: false, basePriceCents: 9500, totalCents: 9500 });
    expect(order.mealSelections.map((m) => [m.mealName, m.quantity])).toEqual([
      ["Chicken Poke Bowl", 4],
      ["Mexican Beef Bowl", 6],
    ]);
    expect(order.emails[0].text).toContain("4× Chicken Poke Bowl, 6× Mexican Beef Bowl (per week)");
  });

  it("rejects dish choices that don't add up to the package", async () => {
    const { meals } = await setup();
    const errors = await fieldErrors(
      createOrderRequest(input({ mealSelections: [{ mealId: meals[0].id, quantity: 9 }] }), { now: NOW }),
    );
    expect(errors.mealSelections).toMatch(/Add 1 more meal/);
    const none = await fieldErrors(createOrderRequest(input({ mealSelections: [] }), { now: NOW }));
    expect(none.mealSelections).toMatch(/Choose your 10 meals/);
  });

  it("rejects dishes that are no longer on the menu", async () => {
    const { meals } = await setup();
    await db.meal.update({ where: { id: meals[1].id }, data: { isPublished: false } });
    const errors = await fieldErrors(
      createOrderRequest(
        input({
          mealSelections: [
            { mealId: meals[0].id, quantity: 5 },
            { mealId: meals[1].id, quantity: 5 },
          ],
        }),
        { now: NOW },
      ),
    );
    expect(errors.mealSelections).toMatch(/no longer on the menu/);
  });
});

describe("first week at €6 a meal with a 2-hour window", () => {
  const tenMeals = (meals: { id: string }[]) => [
    { mealId: meals[0].id, quantity: 5 },
    { mealId: meals[1].id, quantity: 5 },
  ];

  it("applies inside the visitor's window and records it for verification", async () => {
    const { meals } = await setup();
    const result = await createOrderRequest(
      input({ firstOrderDeclared: true, mealSelections: tenMeals(meals) }),
      { now: NOW, offerWindowStartedAt: new Date(NOW.getTime() - 30 * MIN) },
    );
    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { redemption: true } });
    expect(order).toMatchObject({ basePriceCents: 9500, discountCents: 3500, totalCents: 6000, promotionName: "First week €6 a meal" });
    expect(order.redemption?.status).toBe("REQUESTED");
    expect(order.promotionEndsAt?.getTime()).toBe(NOW.getTime() - 30 * MIN + 120 * MIN);
  });

  it("doesn't apply after the window ends, or without a window", async () => {
    const { meals } = await setup();
    const late = await createOrderRequest(input({ firstOrderDeclared: true, mealSelections: tenMeals(meals) }), {
      now: NOW,
      offerWindowStartedAt: new Date(NOW.getTime() - 121 * MIN),
    });
    expect(await db.order.findUniqueOrThrow({ where: { id: late.orderId } })).toMatchObject({ totalCents: 9500, discountCents: 0 });

    const none = await createOrderRequest(
      input({ email: "other@example.com", phone: "7999 1111", firstOrderDeclared: true, mealSelections: tenMeals(meals) }),
      { now: NOW, offerWindowStartedAt: null },
    );
    expect(await db.order.findUniqueOrThrow({ where: { id: none.orderId } })).toMatchObject({ totalCents: 9500 });
  });

  it("discounts only the first week of a monthly subscription", async () => {
    await setup();
    const qc = await quoteForOrder({
      planSlug: "monthly-lunch-dinner-7-days",
      firstOrderDeclared: true,
      now: NOW,
      offerWindowStartedAt: new Date(NOW.getTime() - MIN),
    });
    expect(qc?.quote).toMatchObject({ basePriceCents: 45000, discountCents: 2850, totalCents: 42150 });
    expect(qc?.plan).toMatchObject({ mealsPerWeek: 14, isSubscription: true });
  });
});
