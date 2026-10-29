import { db } from "@/lib/db";
import type { EligibilityStatus, OrderStatus, Prisma } from "@/generated/prisma/client";

let seq = 0;

export async function createTestCustomer(overrides: Partial<Prisma.CustomerCreateInput> = {}) {
  seq++;
  const email = (overrides.email as string | undefined) ?? `customer${seq}@example.test`;
  const phone = (overrides.phone as string | undefined) ?? `+3567900${String(1000 + seq).slice(-4)}`;
  return db.customer.create({
    data: {
      name: `Test Customer ${seq}`,
      email,
      phone,
      firstOrderAt: new Date(),
      lastOrderAt: new Date(),
      identities: { create: [{ type: "EMAIL", value: email }, { type: "PHONE", value: phone }] },
      ...overrides,
    },
  });
}

export async function createTestOrder(
  overrides: Partial<{
    customerId: string | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    status: OrderStatus;
    planName: string;
    planId: string | null;
    basePriceCents: number | null;
    discountCents: number;
    totalCents: number | null;
    promotionId: string | null;
    promotionName: string | null;
    promotionAudience: "ALL_CUSTOMERS" | "NEW_CUSTOMERS" | "SELECTED_CUSTOMERS" | null;
    eligibilityStatus: EligibilityStatus;
    eligibilityReasons: string[];
    fulfillmentMethod: "COLLECTION" | "DELIVERY";
    deliveryLocality: string | null;
    allergies: string | null;
    createdAt: Date;
    utmSource: string | null;
    withRedemption: boolean;
  }> = {},
) {
  seq++;
  const n = seq;
  const order = await db.order.create({
    data: {
      reference: `MCP-T${String(n).padStart(5, "0")}`,
      idempotencyKey: `test-${n}-${Math.random().toString(36).slice(2)}`,
      status: overrides.status ?? "NEW",
      customerId: overrides.customerId ?? null,
      customerName: overrides.customerName ?? `Order Person ${n}`,
      customerEmail: overrides.customerEmail ?? `order${n}@example.test`,
      customerPhone: overrides.customerPhone ?? `+3567911${String(1000 + n).slice(-4)}`,
      whatsappNumber: "+35679119999",
      fulfillmentMethod: overrides.fulfillmentMethod ?? "DELIVERY",
      deliveryLocality: overrides.deliveryLocality === undefined ? "Sliema" : overrides.deliveryLocality,
      addressLine1: "1, Triq it-Torri",
      postalCode: "SLM 1234",
      allergies: overrides.allergies === undefined ? "Peanuts" : overrides.allergies,
      dietaryPreferences: "High protein",
      notes: "Ring the bell",
      planId: overrides.planId ?? null,
      planName: overrides.planName ?? "2 Weeks",
      planDurationDays: 14,
      basePriceCents: overrides.basePriceCents === undefined ? 12000 : overrides.basePriceCents,
      discountCents: overrides.discountCents ?? 0,
      totalCents: overrides.totalCents === undefined ? 12000 - (overrides.discountCents ?? 0) : overrides.totalCents,
      promotionId: overrides.promotionId ?? null,
      promotionName: overrides.promotionName ?? null,
      promotionAudience: overrides.promotionAudience ?? null,
      eligibilityStatus: overrides.eligibilityStatus ?? "NOT_REQUIRED",
      eligibilityReasons: overrides.eligibilityReasons ?? [],
      privacyAcknowledgedAt: new Date(),
      allergyConsentAt: new Date(),
      utmSource: overrides.utmSource ?? null,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
  if (overrides.withRedemption && order.promotionId) {
    await db.promotionRedemption.create({
      data: {
        promotionId: order.promotionId,
        orderId: order.id,
        customerId: order.customerId,
        status: "REQUESTED",
        discountCents: order.discountCents,
      },
    });
  }
  return order;
}
