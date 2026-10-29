import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/client";
import { getKitchenWeek } from "@/lib/admin/kitchen";
import { db } from "@/lib/db";
import { orderRequestSchema } from "@/lib/orders/schema";
import { createOrderRequest } from "@/lib/orders/service";
import { evenSplit } from "@/lib/packages";
import { applyReleases } from "../../prisma/releases";

const WEEK = "2030-01-07"; // a Monday

/** An order for `planSlug` with its status and start date set directly. */
async function order(planSlug: string, status: OrderStatus, start: string | null, meals: number) {
  const dishes = await db.meal.findMany({ where: { isPublished: true }, orderBy: { sortOrder: "asc" } });
  const input = orderRequestSchema.parse({
    idempotencyKey: randomUUID(),
    planSlug,
    mealSelections: evenSplit(
      dishes.map((d) => d.id),
      meals,
    ),
    fullName: "Kitchen Test",
    email: `k.${randomUUID().slice(0, 8)}@example.com`,
    phone: `79${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`,
    fulfillmentMethod: "COLLECTION",
    privacyAccepted: true,
    firstOrderDeclared: false,
    allergyConsent: false,
    marketingOptIn: false,
  });
  const { orderId } = await createOrderRequest(input);
  await db.order.update({
    where: { id: orderId },
    data: { status, preferredStartDate: start ? new Date(`${start}T00:00:00Z`) : null },
  });
}

describe("kitchen summary", () => {
  it("adds up the weekly dishes of every order that runs during the week", async () => {
    await applyReleases(db, () => {});
    await order("lunch-5-days", "CONFIRMED", WEEK, 5); // counts: 1 of each dish
    await order("lunch-dinner-5-days", "IN_PREPARATION", "2030-01-09", 10); // starts mid-week: counts, 2 of each
    await order("monthly-lunch-dinner-5-days", "CONFIRMED", "2029-12-24", 10); // monthly, week 3 of 4: counts
    await order("lunch-5-days", "CONFIRMED", "2029-12-31", 5); // ended the day before: no
    await order("lunch-5-days", "CONFIRMED", "2030-01-14", 5); // starts the week after: no
    await order("lunch-5-days", "CANCELLED", WEEK, 5); // cancelled: no
    await order("lunch-7-days", "NEW", WEEK, 7); // not confirmed yet: shown separately
    await order("lunch-5-days", "CONFIRMED", null, 5); // no start date

    const week = await getKitchenWeek(WEEK);
    expect(week.confirmedOrders).toBe(3);
    expect(week.pendingOrders).toBe(1);
    expect(week.confirmedMeals).toBe(25);
    expect(week.pendingMeals).toBe(7);
    expect(week.undated).toBe(1);
    expect(week.dishes).toHaveLength(5);
    for (const d of week.dishes) expect(d.confirmed).toBe(5);
    expect(week.dishes.reduce((n, d) => n + d.pending, 0)).toBe(7);
  });

  it("is empty when nothing is booked", async () => {
    const week = await getKitchenWeek(WEEK);
    expect(week).toMatchObject({ confirmedOrders: 0, pendingOrders: 0, confirmedMeals: 0, dishes: [], undated: 0 });
  });
});
