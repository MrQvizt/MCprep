import "server-only";
import { logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import type { CustomerManualStatus, Prisma } from "@/generated/prisma/client";
import { OrderActionError } from "./orders";

export const CUSTOMER_PAGE_SIZE = 25;
export const REMOVED = "[removed]";

/** Statuses that mean a customer has actually been served. */
export const SERVED_ORDER_STATUSES = ["CONFIRMED", "IN_PREPARATION", "COMPLETED"] as const;

export type CustomerStatusKind = "NEW" | "RETURNING" | "MANUAL_FIRST_TIME" | "MANUAL_EXISTING" | "ANONYMISED";

export function customerStatus(c: {
  manualStatus: CustomerManualStatus | null;
  anonymizedAt: Date | null;
  servedOrders: number;
}): { kind: CustomerStatusKind; label: string; tone: "neutral" | "good" | "info" | "warn" | "dark" } {
  if (c.anonymizedAt) return { kind: "ANONYMISED", label: "Anonymised", tone: "neutral" };
  if (c.manualStatus === "EXISTING") return { kind: "MANUAL_EXISTING", label: "Existing customer (set manually)", tone: "dark" };
  if (c.manualStatus === "FIRST_TIME") return { kind: "MANUAL_FIRST_TIME", label: "First-time customer (set manually)", tone: "info" };
  if (c.servedOrders > 0) return { kind: "RETURNING", label: "Returning customer", tone: "good" };
  return { kind: "NEW", label: "New customer", tone: "warn" };
}

export async function listCustomers(opts: { q: string; page: number }) {
  const q = opts.q.trim().slice(0, 120);
  const digits = q.replace(/\D/g, "");
  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
          { orders: { some: { reference: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: [{ lastOrderAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (opts.page - 1) * CUSTOMER_PAGE_SIZE,
      take: CUSTOMER_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        manualStatus: true,
        anonymizedAt: true,
        firstOrderAt: true,
        lastOrderAt: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    db.customer.count({ where }),
  ]);
  const served = rows.length
    ? await db.order.groupBy({
        by: ["customerId"],
        where: { customerId: { in: rows.map((r) => r.id) }, status: { in: [...SERVED_ORDER_STATUSES] } },
        _count: { _all: true },
      })
    : [];
  const servedMap = new Map(served.map((s) => [s.customerId, s._count._all]));
  const items = rows.map((r) => ({ ...r, servedOrders: servedMap.get(r.id) ?? 0 }));
  return { items, total, pages: Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE)) };
}

export async function getCustomerDetail(id: string) {
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      identities: { orderBy: { createdAt: "asc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          status: true,
          planName: true,
          totalCents: true,
          confirmedTotalCents: true,
          currency: true,
          promotionName: true,
          eligibilityStatus: true,
          createdAt: true,
        },
      },
      marketingConsents: { orderBy: { grantedAt: "desc" } },
      redemptions: { include: { promotion: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) return null;
  const servedOrders = customer.orders.filter((o) => (SERVED_ORDER_STATUSES as readonly string[]).includes(o.status)).length;
  const history = await db.auditLog.findMany({
    where: { entityType: "Customer", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, summary: true, actorEmail: true, createdAt: true },
  });
  return { ...customer, servedOrders, history };
}

export const MANUAL_STATUS_LABELS: Record<"AUTO" | CustomerManualStatus, string> = {
  AUTO: "Automatic (based on order history)",
  FIRST_TIME: "First-time customer",
  EXISTING: "Existing customer",
};

export async function setCustomerManualStatus(input: {
  customerId: string;
  status: CustomerManualStatus | null;
  actor: AuditActor;
}) {
  const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { manualStatus: true, anonymizedAt: true } });
  if (!customer) throw new OrderActionError("This customer no longer exists.");
  if (customer.manualStatus === input.status) return;
  await db.customer.update({ where: { id: input.customerId }, data: { manualStatus: input.status } });
  await logAudit({
    actor: input.actor,
    action: "customer.status",
    entityType: "Customer",
    entityId: input.customerId,
    summary: `Customer status: ${MANUAL_STATUS_LABELS[customer.manualStatus ?? "AUTO"]} → ${MANUAL_STATUS_LABELS[input.status ?? "AUTO"]}`,
    changes: { from: customer.manualStatus, to: input.status },
  });
}

export async function updateCustomerNotes(input: { customerId: string; notes: string | null; actor: AuditActor }) {
  const exists = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
  if (!exists) throw new OrderActionError("This customer no longer exists.");
  await db.customer.update({ where: { id: input.customerId }, data: { notes: input.notes?.trim() || null } });
  await logAudit({
    actor: input.actor,
    action: "customer.notes",
    entityType: "Customer",
    entityId: input.customerId,
    summary: "Updated customer notes",
  });
}

export async function withdrawMarketingConsent(input: { consentId: string; actor: AuditActor; now?: Date }) {
  const consent = await db.marketingConsent.findUnique({ where: { id: input.consentId } });
  if (!consent) throw new OrderActionError("This consent record no longer exists.");
  if (consent.status === "WITHDRAWN") return;
  await db.marketingConsent.update({
    where: { id: consent.id },
    data: { status: "WITHDRAWN", withdrawnAt: input.now ?? new Date() },
  });
  await logAudit({
    actor: input.actor,
    action: "customer.consent_withdraw",
    entityType: "Customer",
    entityId: consent.customerId,
    summary: "Marketing consent withdrawn (recorded by an administrator)",
  });
}

/** Everything stored about a customer, for a data-access (GDPR) request. */
export async function exportCustomerData(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      identities: { select: { type: true, value: true, createdAt: true } },
      marketingConsents: {
        select: { email: true, channel: true, status: true, source: true, consentText: true, grantedAt: true, withdrawnAt: true },
      },
      redemptions: { select: { status: true, discountCents: true, createdAt: true, promotion: { select: { name: true } } } },
      orders: {
        orderBy: { createdAt: "asc" },
        select: {
          reference: true,
          status: true,
          createdAt: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          whatsappNumber: true,
          fulfillmentMethod: true,
          deliveryLocality: true,
          addressLine1: true,
          addressLine2: true,
          postalCode: true,
          collectionPointName: true,
          preferredStartDate: true,
          mealPreference: true,
          dietaryPreferences: true,
          allergies: true,
          specialInstructions: true,
          notes: true,
          planName: true,
          planDurationDays: true,
          currency: true,
          basePriceCents: true,
          deliveryFeeCents: true,
          discountCents: true,
          totalCents: true,
          confirmedTotalCents: true,
          promotionName: true,
          promotionCode: true,
          eligibilityStatus: true,
          paymentStatus: true,
          privacyAcknowledgedAt: true,
          allergyConsentAt: true,
          firstOrderDeclared: true,
          marketingOptIn: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          landingPath: true,
          referrerHost: true,
        },
      },
    },
  });
  if (!customer) return null;
  return {
    exportedAt: new Date().toISOString(),
    note: "Personal data held by MC PREPS about this customer. Internal staff notes are excluded.",
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      firstOrderAt: customer.firstOrderAt,
      lastOrderAt: customer.lastOrderAt,
      createdAt: customer.createdAt,
      anonymizedAt: customer.anonymizedAt,
    },
    identities: customer.identities,
    orders: customer.orders,
    promotionRedemptions: customer.redemptions.map((r) => ({
      promotion: r.promotion.name,
      status: r.status,
      discountCents: r.discountCents,
      createdAt: r.createdAt,
    })),
    marketingConsents: customer.marketingConsents,
  };
}

/**
 * Anonymise a customer (right to erasure). Personal fields on the customer and
 * all of their orders are removed; pricing snapshots, plan, status and dates
 * are kept for accounting records. Identities and consents are deleted, and
 * stored email copies are redacted.
 */
export async function anonymizeCustomer(input: { customerId: string; actor: AuditActor; now?: Date }) {
  const now = input.now ?? new Date();
  const result = await db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true, anonymizedAt: true, orders: { select: { id: true } } },
    });
    if (!customer) throw new OrderActionError("This customer no longer exists.");
    if (customer.anonymizedAt) throw new OrderActionError("This customer has already been anonymised.");
    const orderIds = customer.orders.map((o) => o.id);

    if (orderIds.length) {
      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: {
          customerName: REMOVED,
          customerEmail: REMOVED,
          customerPhone: REMOVED,
          whatsappNumber: null,
          addressLine1: null,
          addressLine2: null,
          postalCode: null,
          mealPreference: null,
          dietaryPreferences: null,
          allergies: null,
          allergyConsentAt: null,
          specialInstructions: null,
          notes: null,
          confirmationTokenHash: null,
          confirmationExpiresAt: null,
        },
      });
      // Internal notes and decision notes may mention the person.
      await tx.orderNote.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.orderStatusHistory.updateMany({ where: { orderId: { in: orderIds } }, data: { note: null } });
      await tx.promotionEligibilityReview.updateMany({ where: { orderId: { in: orderIds } }, data: { note: null } });
      // Stored copies of order emails contain personal details.
      await tx.emailOutbox.updateMany({
        where: { orderId: { in: orderIds } },
        data: { toAddress: REMOVED, replyTo: null, html: "", text: "" },
      });
    }
    await tx.marketingConsent.deleteMany({
      where: { OR: [{ customerId: customer.id }, ...(orderIds.length ? [{ orderId: { in: orderIds } }] : [])] },
    });
    await tx.customerIdentity.deleteMany({ where: { customerId: customer.id } });
    await tx.customer.update({
      where: { id: customer.id },
      data: { name: REMOVED, email: null, phone: null, notes: null, anonymizedAt: now },
    });
    return { orders: orderIds.length };
  });
  await logAudit({
    actor: input.actor,
    action: "customer.anonymise",
    entityType: "Customer",
    entityId: input.customerId,
    summary: `Anonymised customer data (${result.orders} order${result.orders === 1 ? "" : "s"} redacted, pricing kept)`,
  });
  return result;
}
