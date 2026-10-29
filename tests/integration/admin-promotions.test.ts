import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { savePromotion } from "@/app/admin/(dashboard)/promotions/actions";
import {
  PromotionConflictError,
  createPromotion,
  deletePromotion,
  duplicatePromotion,
  parsePromotionForm,
  updatePromotion,
} from "@/lib/admin/promotions";
import { db } from "@/lib/db";
import { orderRequestSchema } from "@/lib/orders/schema";
import { createOrderRequest } from "@/lib/orders/service";
import { form, initial, runAction } from "./admin-form-utils";
import { createPlan, signInAs } from "./helpers";

const TZ = "Europe/Malta";

const fields = (overrides: Record<string, string | string[] | boolean> = {}) =>
  form({
    name: "MC PREPS Halloween Special",
    slug: "halloween-2026",
    theme: "HALLOWEEN",
    headline: "Halloween fuel deal",
    description: "Get {discount} off your first plan.",
    ctaText: "Claim your offer",
    discountType: "PERCENTAGE",
    discountPercent: "20",
    audience: "NEW_CUSTOMERS",
    planScope: "all",
    startsAt: "2026-10-29T00:00",
    endsAt: "2026-10-31T23:59",
    isEnabled: true,
    showCountdown: true,
    showOnHomepage: true,
    perCustomerLimit: "1",
    expiredBehavior: "HIDE",
    ...overrides,
  });

function fieldErrors(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (e) {
    if (e instanceof ZodError) return Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));
    throw e;
  }
  return {};
}

describe("promotion form parsing", () => {
  it("converts Malta wall-clock times to UTC (CET and CEST)", () => {
    const winter = parsePromotionForm(fields(), TZ);
    expect(winter.endsAt.toISOString()).toBe("2026-10-31T22:59:00.000Z");
    expect(winter.startsAt.toISOString()).toBe("2026-10-28T23:00:00.000Z");
    expect(winter.discountValue).toBe(2000);
    const summer = parsePromotionForm(fields({ startsAt: "2026-07-01T09:00", endsAt: "2026-07-04T09:00" }), TZ);
    expect(summer.startsAt.toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });

  it("requires the end to be after the start", () => {
    const errors = fieldErrors(() => parsePromotionForm(fields({ endsAt: "2026-10-28T12:00" }), TZ));
    expect(errors.endsAt).toMatch(/after the start/);
  });

  it("requires a code for selected-customer offers and normalises codes to upper case", () => {
    const errors = fieldErrors(() => parsePromotionForm(fields({ audience: "SELECTED_CUSTOMERS" }), TZ));
    expect(errors.code).toMatch(/need a code/);
    const parsed = parsePromotionForm(fields({ audience: "SELECTED_CUSTOMERS", code: " vip-fuel " }), TZ);
    expect(parsed).toMatchObject({ requiresCode: true, code: "VIP-FUEL", showOnHomepage: false });
  });

  it("validates fixed amounts, plan selection and percentages", () => {
    expect(fieldErrors(() => parsePromotionForm(fields({ discountPercent: "150" }), TZ)).discountPercent).toBeDefined();
    expect(fieldErrors(() => parsePromotionForm(fields({ planScope: "selected" }), TZ)).planIds).toBeDefined();
    const fixed = parsePromotionForm(fields({ discountType: "FIXED_AMOUNT", discountAmount: "15" }), TZ);
    expect(fixed).toMatchObject({ discountType: "FIXED_AMOUNT", discountValue: 1500, maxDiscountCents: null });
  });
});

describe("admin promotions", () => {
  it("creates a campaign with eligible plans and rejects duplicate codes", async () => {
    const admin = await signInAs("ADMIN");
    const plan = await createPlan({ slug: "2-weeks" });
    const { promotion } = await createPromotion(
      admin,
      parsePromotionForm(fields({ planScope: "selected", planIds: [plan.id], requiresCode: true, code: "fuel20" }), TZ),
    );
    expect(promotion).toMatchObject({ code: "FUEL20", audience: "NEW_CUSTOMERS", appliesToAllPlans: false, isDemo: false });
    expect(await db.promotionEligiblePlan.count({ where: { promotionId: promotion.id } })).toBe(1);

    await expect(
      createPromotion(admin, parsePromotionForm(fields({ slug: "other", requiresCode: true, code: "FUEL20" }), TZ)),
    ).rejects.toBeInstanceOf(PromotionConflictError);

    // Switching to all plans removes the plan links.
    await updatePromotion(admin, promotion.id, parsePromotionForm(fields({ requiresCode: true, code: "FUEL20" }), TZ));
    expect(await db.promotionEligiblePlan.count({ where: { promotionId: promotion.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { entityId: promotion.id } })).toBe(2);
  });

  it("links selected customers by email and reports unknown emails", async () => {
    const admin = await signInAs("ADMIN");
    const customer = await db.customer.create({
      data: { name: "Maria", email: "maria@example.com", identities: { create: { type: "EMAIL", value: "maria@example.com" } } },
    });
    const { promotion, unmatched } = await createPromotion(
      admin,
      parsePromotionForm(fields({ audience: "SELECTED_CUSTOMERS", code: "VIP", selectedEmails: "Maria@Example.com\nnobody@example.com" }), TZ),
    );
    expect(unmatched).toEqual(["nobody@example.com"]);
    const links = await db.promotionSelectedCustomer.findMany({ where: { promotionId: promotion.id } });
    expect(links.map((l) => l.customerId)).toEqual([customer.id]);
  });

  it("reuses a campaign for another occasion (disabled copy, no code)", async () => {
    const admin = await signInAs("ADMIN");
    const { promotion } = await createPromotion(admin, parsePromotionForm(fields({ requiresCode: true, code: "BOO" }), TZ));
    const copy = await duplicatePromotion(admin, promotion.id, { name: "MC PREPS Black Friday", slug: "black-friday", theme: "BLACK_FRIDAY" });
    expect(copy).toMatchObject({
      name: "MC PREPS Black Friday",
      theme: "BLACK_FRIDAY",
      isEnabled: false,
      code: null,
      discountValue: 2000,
      audience: "NEW_CUSTOMERS",
    });
    expect(copy.endsAt.getTime()).toBeGreaterThan(copy.startsAt.getTime());
    await expect(
      duplicatePromotion(admin, promotion.id, { name: "Again", slug: "black-friday", theme: "BLACK_FRIDAY" }),
    ).rejects.toBeInstanceOf(PromotionConflictError);
  });

  it("keeps campaigns that have orders and deletes unused ones", async () => {
    const admin = await signInAs("ADMIN");
    await createPlan({ slug: "2-weeks", priceCents: 12000 });
    const now = new Date();
    const local = (d: Date) => new Date(d.getTime() + 2 * 3_600_000).toISOString().slice(0, 16);
    const { promotion } = await createPromotion(
      admin,
      parsePromotionForm(fields({ audience: "ALL_CUSTOMERS", startsAt: local(new Date(now.getTime() - 86_400_000)), endsAt: local(new Date(now.getTime() + 86_400_000)) }), TZ),
    );
    const order = await createOrderRequest(
      orderRequestSchema.parse({
        idempotencyKey: randomUUID(),
        planSlug: "2-weeks",
        fullName: "Joe Camilleri",
        email: "joe@example.com",
        phone: "7912 3457",
        fulfillmentMethod: "COLLECTION",
        privacyAccepted: true,
        firstOrderDeclared: false,
        allergyConsent: false,
        marketingOptIn: false,
      }),
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: order.orderId } })).promotionId).toBe(promotion.id);
    expect(await deletePromotion(admin, promotion.id)).toBe("blocked");

    const { promotion: unused } = await createPromotion(admin, parsePromotionForm(fields({ slug: "unused" }), TZ));
    expect(await deletePromotion(admin, unused.id)).toBe("deleted");
  });

  it("saves through the server action with field errors for conflicts", async () => {
    await signInAs("OWNER");
    const created = await runAction(() => savePromotion(null, initial, fields()));
    expect(created.redirectTo).toMatch(/^\/admin\/promotions\//);
    const dup = await savePromotion(null, initial, fields());
    expect(dup.ok).toBe(false);
    expect(dup.fieldErrors?.slug).toMatch(/already uses/);
    const bad = await savePromotion(null, initial, fields({ slug: "bad", endsAt: "2026-10-01T00:00" }));
    expect(bad.fieldErrors?.endsAt).toBeDefined();
  });
});
