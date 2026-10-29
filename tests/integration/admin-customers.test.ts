import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { customerStatus, exportCustomerData } from "@/lib/admin/customers";
import { orderRequestSchema } from "@/lib/orders/schema";
import { createOrderRequest } from "@/lib/orders/service";
import {
  anonymizeCustomerAction,
  saveCustomerNotesAction,
  setCustomerStatusAction,
  withdrawConsentAction,
} from "@/app/admin/(dashboard)/customers/actions";
import { GET as exportCustomerRoute } from "@/app/api/admin/customers/[id]/export/route";
import { createPlan, signInAs, signOutTest } from "./helpers";
import { createTestCustomer, createTestOrder } from "./admin-orders.fixtures";

const initial = { ok: false };

function fd(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

/** A real order request through the public submission service (with emails + consent). */
async function realOrder() {
  await db.siteSetting.upsert({
    where: { key: "contact" },
    create: { key: "contact", value: { orderNotificationEmails: ["orders@mcpreps.test"] } },
    update: {},
  });
  await createPlan({ slug: "2-weeks", name: "2 Weeks", priceCents: 12000 });
  const result = await createOrderRequest(
    orderRequestSchema.parse({
      idempotencyKey: randomUUID(),
      planSlug: "2-weeks",
      fullName: "Maria Borg",
      email: "maria.borg@example.com",
      phone: "7912 3456",
      fulfillmentMethod: "COLLECTION",
      privacyAccepted: true,
      firstOrderDeclared: false,
      allergies: "Peanuts",
      allergyConsent: true,
      marketingOptIn: true,
    }),
  );
  return db.order.findUniqueOrThrow({ where: { id: result.orderId } });
}

async function redirectedTo(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (!digest.startsWith("NEXT_REDIRECT")) throw error;
    return digest.split(";")[2] ?? "";
  }
}

describe("customer anonymisation (right to erasure)", () => {
  it("removes personal data but keeps the pricing snapshot for accounting", async () => {
    await signInAs("OWNER");
    const order = await realOrder();
    const customerId = order.customerId!;
    expect(customerId).toBeTruthy();
    await db.orderNote.create({ data: { orderId: order.id, body: "Lives above the pharmacy" } });
    expect(await db.marketingConsent.count({ where: { customerId } })).toBeGreaterThan(0);
    expect(await db.emailOutbox.count({ where: { orderId: order.id } })).toBeGreaterThan(0);

    const target = await redirectedTo(anonymizeCustomerAction(customerId));
    expect(target).toBe(`/admin/customers/${customerId}?anonymised=1`);

    const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(customer).toMatchObject({ name: "[removed]", email: null, phone: null, notes: null });
    expect(customer.anonymizedAt).not.toBeNull();
    expect(await db.customerIdentity.count({ where: { customerId } })).toBe(0);
    expect(await db.marketingConsent.count({ where: { OR: [{ customerId }, { orderId: order.id }] } })).toBe(0);

    const after = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { internalNotes: true, emails: true } });
    expect(after).toMatchObject({
      customerName: "[removed]",
      customerEmail: "[removed]",
      customerPhone: "[removed]",
      whatsappNumber: null,
      allergies: null,
      allergyConsentAt: null,
      confirmationTokenHash: null,
      // pricing snapshot kept
      planName: order.planName,
      basePriceCents: order.basePriceCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
      status: order.status,
    });
    expect(after.internalNotes).toHaveLength(0);
    expect(after.emails.every((e) => e.toAddress === "[removed]" && e.html === "" && e.text === "")).toBe(true);
    expect(JSON.stringify(after)).not.toContain("maria");

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "customer.anonymise", entityId: customerId } });
    expect(audit.summary).not.toMatch(/Maria/i);

    // Second attempt is refused.
    const again = await anonymizeCustomerAction(customerId);
    expect(again?.ok).toBe(false);
  });

  it("cannot be run by content editors or signed-out users", async () => {
    const customer = await createTestCustomer();
    await createTestOrder({ customerId: customer.id });
    signOutTest();
    expect((await anonymizeCustomerAction(customer.id))?.ok).toBe(false);
    await signInAs("EDITOR");
    expect((await anonymizeCustomerAction(customer.id))?.ok).toBe(false);
    const unchanged = await db.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(unchanged.anonymizedAt).toBeNull();
  });
});

describe("customer status, notes and consent", () => {
  it("records manual status changes in the audit trail", async () => {
    await signInAs("ADMIN");
    const customer = await createTestCustomer();
    expect(customerStatus({ ...customer, servedOrders: 0 }).kind).toBe("NEW");
    expect(customerStatus({ ...customer, servedOrders: 2 }).kind).toBe("RETURNING");

    expect((await setCustomerStatusAction(customer.id, initial, fd({ manualStatus: "EXISTING" }))).ok).toBe(true);
    let updated = await db.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(updated.manualStatus).toBe("EXISTING");
    expect(customerStatus({ ...updated, servedOrders: 0 }).kind).toBe("MANUAL_EXISTING");

    await setCustomerStatusAction(customer.id, initial, fd({ manualStatus: "AUTO" }));
    updated = await db.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(updated.manualStatus).toBeNull();
    expect(await db.auditLog.count({ where: { action: "customer.status", entityId: customer.id } })).toBe(2);

    expect((await setCustomerStatusAction(customer.id, initial, fd({ manualStatus: "VIP" }))).ok).toBe(false);
    expect((await saveCustomerNotesAction(customer.id, initial, fd({ notes: "Prefers WhatsApp" }))).ok).toBe(true);
    expect((await db.customer.findUniqueOrThrow({ where: { id: customer.id } })).notes).toBe("Prefers WhatsApp");
  });

  it("withdraws marketing consent", async () => {
    await signInAs("ADMIN");
    const customer = await createTestCustomer();
    const consent = await db.marketingConsent.create({
      data: { customerId: customer.id, email: customer.email!, source: "order_form", consentText: "Yes please" },
    });
    expect((await withdrawConsentAction(customer.id, consent.id)).ok).toBe(true);
    const updated = await db.marketingConsent.findUniqueOrThrow({ where: { id: consent.id } });
    expect(updated.status).toBe("WITHDRAWN");
    expect(updated.withdrawnAt).not.toBeNull();
  });
});

describe("customer data export", () => {
  it("returns the customer's data (without internal notes) to admins only", async () => {
    const customer = await createTestCustomer({ name: "Joe Camilleri" });
    const order = await createTestOrder({ customerId: customer.id, customerName: "Joe Camilleri" });
    await db.orderNote.create({ data: { orderId: order.id, body: "Internal: VIP" } });

    const data = await exportCustomerData(customer.id);
    expect(data?.customer.name).toBe("Joe Camilleri");
    expect(data?.orders).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain("Internal: VIP");

    const ctx = { params: Promise.resolve({ id: customer.id }) };
    signOutTest();
    expect((await exportCustomerRoute(new Request("https://mcpreps.test"), ctx)).status).toBe(401);
    await signInAs("EDITOR");
    expect((await exportCustomerRoute(new Request("https://mcpreps.test"), ctx)).status).toBe(401);

    signOutTest();
    await signInAs("ADMIN");
    const res = await exportCustomerRoute(new Request("https://mcpreps.test"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const json = await res.json();
    expect(json.orders[0].reference).toBe(order.reference);
    expect(await db.auditLog.count({ where: { action: "customer.export", entityId: customer.id } })).toBe(1);
  });
});
