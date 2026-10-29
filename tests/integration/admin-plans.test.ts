import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { savePlan } from "@/app/admin/(dashboard)/plans/actions";
import { savePromotion } from "@/app/admin/(dashboard)/promotions/actions";
import { createPlan, deleteOrArchivePlan, parsePlanForm, updatePlan } from "@/lib/admin/plans";
import { db } from "@/lib/db";
import { orderRequestSchema } from "@/lib/orders/schema";
import { createOrderRequest } from "@/lib/orders/service";
import { form, initial } from "./admin-form-utils";
import { signInAs } from "./helpers";

const plan = (overrides: Record<string, string | boolean> = {}) =>
  form({
    name: "2 Weeks",
    slug: "2-weeks",
    tagline: "Popular",
    durationDays: "14",
    features: "Macro-tracked meals\nCooked fresh",
    price: "120.00",
    isActive: true,
    ...overrides,
  });

async function placeOrder() {
  return createOrderRequest(
    orderRequestSchema.parse({
      idempotencyKey: randomUUID(),
      planSlug: "2-weeks",
      fullName: "Maria Borg",
      email: "maria.borg@example.com",
      phone: "7912 3456",
      fulfillmentMethod: "COLLECTION",
      privacyAccepted: true,
      firstOrderDeclared: false,
      allergyConsent: false,
      marketingOptIn: false,
    }),
  );
}

describe("admin plans", () => {
  it("creates a plan (empty price = price on request) and parses inclusions", async () => {
    const admin = await signInAs("ADMIN");
    const p = await createPlan(admin, parsePlanForm(plan({ price: "" })));
    expect(p).toMatchObject({ priceCents: null, features: ["Macro-tracked meals", "Cooked fresh"], durationDays: 14 });
    expect(() => parsePlanForm(plan({ price: "12.345" }))).toThrow(/12.50/);
    expect(() => parsePlanForm(plan({ durationDays: "0" }))).toThrow();
  });

  it("logs price changes and never alters existing orders' quoted prices", async () => {
    const admin = await signInAs("OWNER");
    const p = await createPlan(admin, parsePlanForm(plan()));
    const { orderId } = await placeOrder();

    await updatePlan(admin, p.id, parsePlanForm(plan({ price: "135.50" })));

    const updated = await db.plan.findUniqueOrThrow({ where: { id: p.id } });
    expect(updated.priceCents).toBe(13550);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.basePriceCents).toBe(12000);
    expect(order.totalCents).toBe(12000);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "plan.price_change", entityId: p.id } });
    expect(log.summary).toMatch(/120\.00.*135\.50/);
    expect(log.changes).toEqual({ priceCents: { from: 12000, to: 13550 } });
  });

  it("keeps only one recommended plan", async () => {
    const admin = await signInAs("OWNER");
    const a = await createPlan(admin, parsePlanForm(plan({ slug: "plan-a", isRecommended: true })));
    const b = await createPlan(admin, parsePlanForm(plan({ slug: "plan-b", isRecommended: true })));
    expect((await db.plan.findUniqueOrThrow({ where: { id: a.id } })).isRecommended).toBe(false);
    expect((await db.plan.findUniqueOrThrow({ where: { id: b.id } })).isRecommended).toBe(true);
  });

  it("archives instead of deleting plans that orders reference", async () => {
    const admin = await signInAs("OWNER");
    const used = await createPlan(admin, parsePlanForm(plan()));
    await placeOrder();
    expect(await deleteOrArchivePlan(admin, used.id)).toBe("archived");
    expect((await db.plan.findUniqueOrThrow({ where: { id: used.id } })).archivedAt).not.toBeNull();

    const unused = await createPlan(admin, parsePlanForm(plan({ slug: "unused" })));
    expect(await deleteOrArchivePlan(admin, unused.id)).toBe("deleted");
    expect(await db.plan.findUnique({ where: { id: unused.id } })).toBeNull();
  });

  it("blocks content editors from changing plans and promotions", async () => {
    await signInAs("EDITOR");
    const res = await savePlan(null, initial, plan());
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/permission/i);
    const promo = await savePromotion(null, initial, form({ name: "X", slug: "x" }));
    expect(promo.ok).toBe(false);
    expect(promo.message).toMatch(/permission/i);
    expect(await db.plan.count()).toBe(0);
  });
});
