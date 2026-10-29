import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { processOutbox } from "@/lib/email/outbox";
import { EmailDeliveryError, type EmailTransport } from "@/lib/email/transport";
import { orderRequestSchema, type OrderRequestInput } from "@/lib/orders/schema";
import { createOrderRequest, OrderValidationError, verifyConfirmationToken } from "@/lib/orders/service";
import { createDeliveryArea, createPlan, createPromotion } from "./helpers";

const NOW = new Date();

async function configureNotifications() {
  await db.siteSetting.create({
    data: { key: "contact", value: { orderNotificationEmails: ["orders@mcpreps.test"], publicEmail: "hello@mcpreps.test" } },
  });
}

function input(overrides: Partial<OrderRequestInput> = {}): ReturnType<typeof orderRequestSchema.parse> {
  return orderRequestSchema.parse({
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
    ...overrides,
  });
}

async function submit(overrides: Partial<OrderRequestInput> = {}) {
  return createOrderRequest(input(overrides), { now: NOW });
}

async function expectValidation(promise: Promise<unknown>, field: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(OrderValidationError);
  expect(Object.keys((error as OrderValidationError).fieldErrors)).toContain(field);
}

describe("order creation", () => {
  it("saves an order with a permanent pricing snapshot, history and queued emails", async () => {
    await configureNotifications();
    await createPlan({ slug: "2-weeks", name: "2 Weeks", priceCents: 12000 });
    const result = await submit({ allergies: "Peanuts", allergyConsent: true });

    expect(result.reference).toMatch(/^MCP-\d{6}$/);
    expect(result.duplicate).toBe(false);
    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { statusHistory: true, emails: true } });
    expect(order).toMatchObject({
      status: "NEW",
      paymentStatus: "NOT_COLLECTED",
      planName: "2 Weeks",
      basePriceCents: 12000,
      discountCents: 0,
      totalCents: 12000,
      customerEmail: "maria.borg@example.com",
      customerPhone: "+35679123456",
      eligibilityStatus: "NOT_REQUIRED",
    });
    expect(order.allergyConsentAt).not.toBeNull();
    expect(order.statusHistory).toHaveLength(1);
    expect(order.emails.map((e) => e.type).sort()).toEqual(["ORDER_BUSINESS_NOTIFICATION", "ORDER_CUSTOMER_CONFIRMATION"]);
    expect(order.emails.find((e) => e.type === "ORDER_BUSINESS_NOTIFICATION")?.subject).toContain(order.reference);
  });

  it("validates phone numbers and plan availability on the server", async () => {
    await createPlan({ slug: "2-weeks" });
    await expectValidation(submit({ phone: "1234567" }), "phone");
    await expectValidation(submit({ planSlug: "does-not-exist" }), "planSlug");
    await createPlan({ slug: "inactive", isActive: false });
    await expectValidation(submit({ planSlug: "inactive" }), "planSlug");
  });

  it("only accepts delivery to published, available localities", async () => {
    await createPlan({ slug: "2-weeks" });
    const unavailable = await createDeliveryArea({ slug: "gozo", deliveryAvailable: false });
    const unpublished = await createDeliveryArea({ slug: "mdina", isPublished: false });
    const ok = await createDeliveryArea({ slug: "sliema", deliveryFeeCents: 500 });
    await expectValidation(submit({ fulfillmentMethod: "DELIVERY", deliveryAreaId: unavailable.id, addressLine1: "1 Main St" }), "deliveryAreaId");
    await expectValidation(submit({ fulfillmentMethod: "DELIVERY", deliveryAreaId: unpublished.id, addressLine1: "1 Main St" }), "deliveryAreaId");
    const result = await submit({ fulfillmentMethod: "DELIVERY", deliveryAreaId: ok.id, addressLine1: "1 Main St" });
    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(order.deliveryLocality).toBe("Sliema");
    expect(order.deliveryFeeCents).toBe(500);
    expect(order.totalCents).toBe(12500);
  });

  it("enforces a locality's minimum order", async () => {
    await createPlan({ slug: "2-weeks", priceCents: 4000 });
    const area = await createDeliveryArea({ minOrderCents: 5000 });
    await expectValidation(submit({ fulfillmentMethod: "DELIVERY", deliveryAreaId: area.id, addressLine1: "x" }), "deliveryAreaId");
  });

  it("rejects start dates before the lead time (Malta calendar)", async () => {
    await createPlan({ slug: "2-weeks" });
    await expectValidation(submit({ preferredStartDate: "2020-01-01" }), "preferredStartDate");
  });

  it("requires allergy consent when allergies are given", () => {
    expect(() => input({ allergies: "Gluten", allergyConsent: false })).toThrow();
  });
});

describe("duplicate prevention", () => {
  it("returns the original order when the same submission is sent twice", async () => {
    await configureNotifications();
    await createPlan({ slug: "2-weeks" });
    const payload = input();
    const first = await createOrderRequest(payload, { now: NOW });
    const second = await createOrderRequest(payload, { now: NOW });
    expect(second.orderId).toBe(first.orderId);
    expect(second.duplicate).toBe(true);
    expect(await db.order.count()).toBe(1);
    expect(await db.emailOutbox.count()).toBe(2);
  });

  it("creates only one order for concurrent duplicate submissions", async () => {
    await createPlan({ slug: "2-weeks" });
    const payload = input();
    const results = await Promise.all([1, 2, 3].map(() => createOrderRequest(payload, { now: NOW })));
    expect(new Set(results.map((r) => r.orderId)).size).toBe(1);
    expect(await db.order.count()).toBe(1);
  });
});

describe("pricing snapshots", () => {
  it("keeps the quoted price when the plan price or promotion changes later", async () => {
    const plan = await createPlan({ slug: "2-weeks", priceCents: 12000 });
    const promo = await createPromotion({ discountValue: 2500 });
    const result = await submit();
    await db.plan.update({ where: { id: plan.id }, data: { priceCents: 15000 } });
    await db.promotion.update({ where: { id: promo.id }, data: { isEnabled: false, discountValue: 5000 } });
    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(order).toMatchObject({ basePriceCents: 12000, discountCents: 3000, totalCents: 9000, promotionDiscountValue: 2500 });
  });
});

describe("promotions at submission", () => {
  it("applies an active promotion and records the redemption", async () => {
    await createPlan({ slug: "2-weeks", priceCents: 12000 });
    const promo = await createPromotion({ discountValue: 2000 });
    const result = await submit();
    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { redemption: true } });
    expect(order.discountCents).toBe(2400);
    expect(order.promotionId).toBe(promo.id);
    expect(order.redemption?.status).toBe("REQUESTED");
  });

  it("does not apply an expired promotion", async () => {
    await createPlan({ slug: "2-weeks", priceCents: 12000 });
    await createPromotion({ startsAt: new Date(NOW.getTime() - 96 * 3_600_000), endsAt: new Date(NOW.getTime() - 1000) });
    const result = await submit();
    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId } });
    expect(order.discountCents).toBe(0);
    expect(order.promotionId).toBeNull();
  });

  it("rejects an invalid coupon instead of silently ignoring it", async () => {
    await createPlan({ slug: "2-weeks" });
    await expectValidation(submit({ couponCode: "NOPE" }), "couponCode");
  });

  it("respects the total redemption limit", async () => {
    await createPlan({ slug: "2-weeks", priceCents: 12000 });
    await createPromotion({ totalRedemptionLimit: 1, perCustomerLimit: null });
    const a = await submit({ email: "a@example.com", phone: "79000001" });
    const b = await submit({ email: "b@example.com", phone: "79000002" });
    const [oa, ob] = await Promise.all([
      db.order.findUniqueOrThrow({ where: { id: a.orderId } }),
      db.order.findUniqueOrThrow({ where: { id: b.orderId } }),
    ]);
    expect(oa.discountCents).toBe(2400);
    expect(ob.discountCents).toBe(0);
  });
});

describe("first-time customer eligibility", () => {
  async function newCustomerPromo() {
    await createPlan({ slug: "2-weeks", priceCents: 12000 });
    return createPromotion({ audience: "NEW_CUSTOMERS", discountValue: 2000 });
  }

  it("needs the customer's declaration before requesting a new-customer discount", async () => {
    await newCustomerPromo();
    const r = await submit({ firstOrderDeclared: false });
    expect((await db.order.findUniqueOrThrow({ where: { id: r.orderId } })).discountCents).toBe(0);
  });

  it("marks a brand-new customer as preliminarily eligible, pending verification", async () => {
    await newCustomerPromo();
    const r = await submit({ firstOrderDeclared: true });
    const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { eligibilityReviews: true } });
    expect(order.discountCents).toBe(2400);
    expect(order.eligibilityStatus).toBe("PRELIMINARY_ELIGIBLE");
    expect(order.eligibilityReviews).toHaveLength(1);
    expect(order.isReturningCustomer).toBe(false);
  });

  it("does not automatically grant the discount to a returning customer", async () => {
    await newCustomerPromo();
    const first = await submit({ email: "joe@gmail.com", phone: "79111111" });
    await db.order.update({ where: { id: first.orderId }, data: { status: "COMPLETED" } });
    // Same mailbox with a +tag and dots — must still be recognised.
    const r = await submit({ email: "j.o.e+deal@gmail.com", phone: "79222222", firstOrderDeclared: true });
    const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(order.eligibilityStatus).toBe("LIKELY_INELIGIBLE");
    expect(order.eligibilityReasons).toContain("PRIOR_CONFIRMED_ORDER");
    expect(order.isReturningCustomer).toBe(true);
    // Stored as a requested discount only — the team decides; the business email flags it.
    const email = await db.emailOutbox.findFirst({ where: { orderId: order.id, type: "ORDER_BUSINESS_NOTIFICATION" } });
    expect(email === null || email.subject.includes("verification")).toBe(true);
  });

  it("detects a repeat redemption by phone number", async () => {
    await newCustomerPromo();
    await submit({ email: "first@example.com", phone: "79333333", firstOrderDeclared: true });
    const r = await submit({ email: "second@example.com", phone: "+356 7933 3333", firstOrderDeclared: true });
    const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(order.eligibilityStatus).toBe("LIKELY_INELIGIBLE");
    expect(order.eligibilityReasons).toContain("PRIOR_REDEMPTION");
  });

  it("gives identical customer-facing results for known and unknown contacts (no data leak)", async () => {
    await newCustomerPromo();
    const known = await submit({ email: "known@example.com", phone: "79444444" });
    await db.order.update({ where: { id: known.orderId }, data: { status: "CONFIRMED" } });
    const a = await submit({ email: "known@example.com", phone: "79444444", firstOrderDeclared: true });
    const b = await submit({ email: "stranger@example.com", phone: "79555555", firstOrderDeclared: true });
    const [oa, ob] = await Promise.all([
      db.order.findUniqueOrThrow({ where: { id: a.orderId } }),
      db.order.findUniqueOrThrow({ where: { id: b.orderId } }),
    ]);
    const visible = (o: typeof oa) => ({ total: o.totalCents, discount: o.discountCents, promotion: o.promotionName });
    expect(visible(oa)).toEqual(visible(ob));
    expect(oa.eligibilityStatus).not.toBe(ob.eligibilityStatus);
  });

  it("links repeat orders to one customer record without duplicating identities", async () => {
    await createPlan({ slug: "2-weeks" });
    await submit({ email: "sam@example.com", phone: "79666666" });
    await submit({ email: "SAM@example.com", phone: "+35679666666" });
    expect(await db.customer.count()).toBe(1);
    expect(await db.customerIdentity.count()).toBe(2);
  });
});

describe("confirmation links", () => {
  it("verifies the confirmation token and rejects tampered ones", async () => {
    await createPlan({ slug: "2-weeks" });
    const r = await submit();
    const order = await db.order.findUniqueOrThrow({ where: { id: r.orderId } });
    const token = new URL(`https://x${r.confirmationUrl}`).searchParams.get("t");
    expect(verifyConfirmationToken(order, token)).toBe(true);
    expect(verifyConfirmationToken(order, "A".repeat(32))).toBe(false);
    expect(verifyConfirmationToken(order, null)).toBe(false);
  });
});

describe("email outbox", () => {
  it("retries failed deliveries with backoff and never loses the order", async () => {
    await configureNotifications();
    await createPlan({ slug: "2-weeks" });
    const r = await submit();
    let calls = 0;
    const failing: EmailTransport = async () => {
      calls++;
      throw new EmailDeliveryError("temporary outage");
    };
    const first = await processOutbox({ ids: r.emailIds, transport: failing });
    expect(first).toMatchObject({ claimed: 2, failed: 2, sent: 0 });
    expect(await db.order.count()).toBe(1);
    const failed = await db.emailOutbox.findMany({ where: { orderId: r.orderId } });
    expect(failed.every((e) => e.status === "FAILED" && e.attempts === 1 && e.nextAttemptAt > new Date())).toBe(true);

    // Not due yet → nothing is claimed.
    expect((await processOutbox({ transport: failing })).claimed).toBe(0);

    // Make them due and succeed.
    await db.emailOutbox.updateMany({ data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    const sentIds: string[] = [];
    const working: EmailTransport = async (e) => {
      sentIds.push(e.id);
      return { provider: "test", messageId: `m-${e.id}` };
    };
    const second = await processOutbox({ transport: working });
    expect(second).toMatchObject({ sent: 2 });
    const sent = await db.emailOutbox.findMany({ where: { orderId: r.orderId } });
    expect(sent.every((e) => e.status === "SENT" && e.sentAt !== null)).toBe(true);
    // Already sent → never sent again.
    expect((await processOutbox({ transport: working })).claimed).toBe(0);
    expect(new Set(sentIds).size).toBe(2);
    expect(calls).toBe(2);
  });

  it("gives up after the maximum number of attempts", async () => {
    await configureNotifications();
    await createPlan({ slug: "2-weeks" });
    const r = await submit();
    await db.emailOutbox.updateMany({ data: { maxAttempts: 1 } });
    const failing: EmailTransport = async () => {
      throw new Error("boom");
    };
    const result = await processOutbox({ ids: r.emailIds, transport: failing });
    expect(result.dead).toBe(2);
  });

  it("leaves emails queued when no provider is configured", async () => {
    await configureNotifications();
    await createPlan({ slug: "2-weeks" });
    await submit();
    const result = await processOutbox({ transport: null });
    expect(result.skipped).toBe("disabled");
    expect(await db.emailOutbox.count({ where: { status: "PENDING" } })).toBe(2);
  });
});
