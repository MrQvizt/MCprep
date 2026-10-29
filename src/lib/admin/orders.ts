import "server-only";
import { logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, PAYMENT_METHODS, type OrderStatusValue, type PaymentMethod } from "@/lib/orders/labels";
import { addDaysToDateString, DEFAULT_TIME_ZONE, zonedLocalToUtc } from "@/lib/time";
import type { EligibilityStatus, OrderStatus, PaymentStatus, Prisma } from "@/generated/prisma/client";

export const ORDER_PAGE_SIZE = 25;
export const CSV_EXPORT_LIMIT = 10_000;

// ── Filters ─────────────────────────────────────────────────────────────────

export const ELIGIBILITY_FILTERS = {
  needs_review: "Promotion needs review",
  NEEDS_REVIEW: "Pending review",
  LIKELY_INELIGIBLE: "Likely returning customer",
  PRELIMINARY_ELIGIBLE: "New customer (preliminary)",
  APPROVED: "Promotion approved",
  REJECTED: "Promotion rejected",
  with_promotion: "Any promotion",
} as const;

export type EligibilityFilter = keyof typeof ELIGIBILITY_FILTERS;

/** Eligibility states that still wait for a human decision. */
export const UNDECIDED_ELIGIBILITY: EligibilityStatus[] = ["PRELIMINARY_ELIGIBLE", "NEEDS_REVIEW", "LIKELY_INELIGIBLE"];

/** Work queues: orders waiting for a confirmation, or confirmed but not paid yet. */
export const ORDER_QUEUES = {
  to_confirm: "To confirm",
  unpaid: "Unpaid",
} as const;
export type OrderQueue = keyof typeof ORDER_QUEUES;
const GOING_AHEAD: OrderStatus[] = ["CONFIRMED", "IN_PREPARATION", "COMPLETED"];

export interface OrderFilters {
  queue: OrderQueue | "";
  q: string;
  status: OrderStatusValue | "";
  eligibility: EligibilityFilter | "";
  fulfillment: "COLLECTION" | "DELIVERY" | "";
  from: string; // YYYY-MM-DD (Malta)
  to: string; // YYYY-MM-DD (Malta), inclusive
  promotion: string;
  customer: string;
  page: number;
}

type SearchParamsLike = Record<string, string | string[] | undefined> | URLSearchParams;

function pick(sp: SearchParamsLike, key: string): string {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.trim().slice(0, 200) : "";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9]{10,40}$/i;

export function parseOrderFilters(sp: SearchParamsLike): OrderFilters {
  const status = pick(sp, "status");
  const eligibility = pick(sp, "eligibility");
  const fulfillment = pick(sp, "fulfillment");
  const from = pick(sp, "from");
  const to = pick(sp, "to");
  const promotion = pick(sp, "promotion");
  const customer = pick(sp, "customer");
  const page = Math.max(1, Math.min(10_000, parseInt(pick(sp, "page"), 10) || 1));
  const queue = pick(sp, "queue");
  return {
    queue: queue in ORDER_QUEUES ? (queue as OrderQueue) : "",
    q: pick(sp, "q").slice(0, 120),
    status: (ORDER_STATUSES as readonly string[]).includes(status) ? (status as OrderStatusValue) : "",
    eligibility: eligibility in ELIGIBILITY_FILTERS ? (eligibility as EligibilityFilter) : "",
    fulfillment: fulfillment === "COLLECTION" || fulfillment === "DELIVERY" ? fulfillment : "",
    from: DATE_RE.test(from) ? from : "",
    to: DATE_RE.test(to) ? to : "",
    promotion: ID_RE.test(promotion) ? promotion : "",
    customer: ID_RE.test(customer) ? customer : "",
    page,
  };
}

/** Query string for links (pagination, export) preserving the active filters. */
export function orderFiltersToQuery(f: OrderFilters, overrides: Partial<OrderFilters> = {}): string {
  const merged = { ...f, ...overrides };
  const params = new URLSearchParams();
  for (const key of ["queue", "q", "status", "eligibility", "fulfillment", "from", "to", "promotion", "customer"] as const) {
    if (merged[key]) params.set(key, String(merged[key]));
  }
  if (merged.page > 1) params.set("page", String(merged.page));
  return params.toString();
}

export function hasActiveFilters(f: OrderFilters): boolean {
  return Boolean(f.queue || f.q || f.status || f.eligibility || f.fulfillment || f.from || f.to || f.promotion || f.customer);
}

export function buildOrderWhere(f: OrderFilters, timeZone: string = DEFAULT_TIME_ZONE): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (f.q) {
    const q = f.q;
    const digits = q.replace(/\D/g, "");
    const or: Prisma.OrderWhereInput[] = [
      { reference: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
    ];
    if (digits.length >= 4) {
      or.push({ customerPhone: { contains: digits } }, { whatsappNumber: { contains: digits } });
    }
    and.push({ OR: or });
  }
  if (f.status) and.push({ status: f.status as OrderStatus });
  if (f.queue === "to_confirm") and.push({ status: { in: ["NEW", "CONTACTED"] } });
  if (f.queue === "unpaid") and.push({ status: { in: GOING_AHEAD }, paymentStatus: { not: "PAID" } });
  if (f.fulfillment) and.push({ fulfillmentMethod: f.fulfillment });
  if (f.promotion) and.push({ promotionId: f.promotion });
  if (f.customer) and.push({ customerId: f.customer });
  if (f.eligibility === "needs_review") {
    and.push({ promotionId: { not: null }, eligibilityStatus: { in: UNDECIDED_ELIGIBILITY }, status: { not: "CANCELLED" } });
  } else if (f.eligibility === "with_promotion") {
    and.push({ promotionId: { not: null } });
  } else if (f.eligibility) {
    and.push({ eligibilityStatus: f.eligibility as EligibilityStatus });
  }
  if (f.from) {
    const from = zonedLocalToUtc(`${f.from}T00:00`, timeZone);
    if (from) and.push({ createdAt: { gte: from } });
  }
  if (f.to) {
    const to = zonedLocalToUtc(`${addDaysToDateString(f.to, 1)}T00:00`, timeZone);
    if (to) and.push({ createdAt: { lt: to } });
  }
  return and.length ? { AND: and } : {};
}

const LIST_SELECT = {
  id: true,
  reference: true,
  status: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  planName: true,
  currency: true,
  totalCents: true,
  basePriceCents: true,
  discountCents: true,
  confirmedTotalCents: true,
  promotionName: true,
  eligibilityStatus: true,
  paymentStatus: true,
  paymentProvider: true,
  fulfillmentMethod: true,
  deliveryLocality: true,
  isReturningCustomer: true,
  isPotentialDuplicate: true,
  createdAt: true,
} as const satisfies Prisma.OrderSelect;

export async function listOrders(f: OrderFilters, timeZone: string = DEFAULT_TIME_ZONE) {
  const where = buildOrderWhere(f, timeZone);
  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * ORDER_PAGE_SIZE,
      take: ORDER_PAGE_SIZE,
      select: LIST_SELECT,
    }),
    db.order.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE)) };
}

export type OrderListItem = Awaited<ReturnType<typeof listOrders>>["items"][number];

// ── Status changes ──────────────────────────────────────────────────────────

/** Expected, user-facing problem (shown as-is in the admin). */
export class OrderActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderActionError";
  }
}

/** Which timestamps a status change fills in (existing values are kept). */
function statusTimestamps(
  to: OrderStatus,
  current: { contactedAt: Date | null; confirmedAt: Date | null; completedAt: Date | null; cancelledAt: Date | null },
  now: Date,
): Prisma.OrderUpdateInput {
  const data: Prisma.OrderUpdateInput = {};
  if (to !== "NEW" && to !== "CANCELLED" && !current.contactedAt) data.contactedAt = now;
  if ((to === "CONFIRMED" || to === "IN_PREPARATION" || to === "COMPLETED") && !current.confirmedAt) data.confirmedAt = now;
  if (to === "COMPLETED" && !current.completedAt) data.completedAt = now;
  if (to === "CANCELLED") data.cancelledAt = now;
  else if (current.cancelledAt) data.cancelledAt = null;
  return data;
}

export async function changeOrderStatus(input: {
  orderId: string;
  toStatus: OrderStatus;
  note?: string | null;
  actor: AuditActor;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const note = input.note?.trim() || null;
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        reference: true,
        status: true,
        eligibilityStatus: true,
        contactedAt: true,
        confirmedAt: true,
        completedAt: true,
        cancelledAt: true,
        redemption: { select: { id: true, status: true } },
      },
    });
    if (!order) throw new OrderActionError("This order no longer exists.");
    if (order.status === input.toStatus && !note) {
      throw new OrderActionError(`This order is already marked as “${ORDER_STATUS_LABELS[order.status]}”.`);
    }
    if (order.status !== input.toStatus) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: input.toStatus, ...statusTimestamps(input.toStatus, order, now) },
      });
      // Promotion redemptions: cancelling frees the slot; re-opening reserves it again.
      if (order.redemption) {
        if (input.toStatus === "CANCELLED" && (order.redemption.status === "REQUESTED" || order.redemption.status === "APPROVED")) {
          await tx.promotionRedemption.update({ where: { id: order.redemption.id }, data: { status: "CANCELLED", decidedAt: now } });
        } else if (order.status === "CANCELLED" && input.toStatus !== "CANCELLED" && order.redemption.status === "CANCELLED") {
          const restored =
            order.eligibilityStatus === "APPROVED" ? "APPROVED" : order.eligibilityStatus === "REJECTED" ? "REJECTED" : "REQUESTED";
          await tx.promotionRedemption.update({ where: { id: order.redemption.id }, data: { status: restored } });
        }
      }
    }
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: input.toStatus,
        changedById: input.actor.id,
        note,
      },
    });
    return { reference: order.reference, from: order.status };
  });
  await logAudit({
    actor: input.actor,
    action: "order.status",
    entityType: "Order",
    entityId: input.orderId,
    summary:
      result.from === input.toStatus
        ? `Added a status note to ${result.reference}`
        : `${result.reference}: ${ORDER_STATUS_LABELS[result.from]} → ${ORDER_STATUS_LABELS[input.toStatus]}`,
    changes: { from: result.from, to: input.toStatus, ...(note ? { note } : {}) },
  });
  return result;
}

// ── Notes, agreed price, payment ────────────────────────────────────────────

export async function addOrderNote(input: { orderId: string; body: string; actor: AuditActor }) {
  const body = input.body.trim();
  if (!body) throw new OrderActionError("Write a note first.");
  const order = await db.order.findUnique({ where: { id: input.orderId }, select: { reference: true } });
  if (!order) throw new OrderActionError("This order no longer exists.");
  const note = await db.orderNote.create({ data: { orderId: input.orderId, authorId: input.actor.id, body: body.slice(0, 4000) } });
  await logAudit({
    actor: input.actor,
    action: "order.note",
    entityType: "Order",
    entityId: input.orderId,
    summary: `Added an internal note to ${order.reference}`,
  });
  return note;
}

export const PAYMENT_STATUSES = ["NOT_COLLECTED", "PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED"] as const;

export async function updateOrderPricePayment(input: {
  orderId: string;
  confirmedTotalCents: number | null;
  paymentStatus: PaymentStatus;
  paidAmountCents: number | null;
  actor: AuditActor;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: { reference: true, confirmedTotalCents: true, paymentStatus: true, paidAmountCents: true, paidAt: true, paymentProvider: true },
  });
  if (!order) throw new OrderActionError("This order no longer exists.");
  const becamePaid = input.paymentStatus === "PAID" && order.paymentStatus !== "PAID";
  await db.order.update({
    where: { id: input.orderId },
    data: {
      confirmedTotalCents: input.confirmedTotalCents,
      paymentStatus: input.paymentStatus,
      paidAmountCents: input.paidAmountCents,
      paidAt: input.paymentStatus === "PAID" ? (order.paidAt ?? now) : input.paymentStatus === "NOT_COLLECTED" ? null : order.paidAt,
      // Manually recorded payments (cash, bank transfer, Revolut …) until online payments are added.
      paymentProvider: becamePaid && !order.paymentProvider ? "manual" : order.paymentProvider,
    },
  });
  await logAudit({
    actor: input.actor,
    action: "order.pricing",
    entityType: "Order",
    entityId: input.orderId,
    summary: `Updated agreed price / payment for ${order.reference}`,
    changes: {
      confirmedTotalCents: { from: order.confirmedTotalCents, to: input.confirmedTotalCents },
      paymentStatus: { from: order.paymentStatus, to: input.paymentStatus },
      paidAmountCents: { from: order.paidAmountCents, to: input.paidAmountCents },
    },
  });
}

/** One click: record a manual payment (method, amount = agreed or quoted total). */
export async function markOrderPaid(input: { orderId: string; method: PaymentMethod; actor: AuditActor; now?: Date }) {
  const now = input.now ?? new Date();
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: { reference: true, status: true, paymentStatus: true, paidAt: true, paidAmountCents: true, confirmedTotalCents: true, totalCents: true, currency: true },
  });
  if (!order) throw new OrderActionError("This order no longer exists.");
  if (order.status === "CANCELLED") throw new OrderActionError("This order is cancelled — re-open it before recording a payment.");
  const amount = order.paidAmountCents ?? order.confirmedTotalCents ?? order.totalCents;
  await db.order.update({
    where: { id: input.orderId },
    data: { paymentStatus: "PAID", paidAt: order.paidAt ?? now, paidAmountCents: amount, paymentProvider: input.method },
  });
  await logAudit({
    actor: input.actor,
    action: "order.paid",
    entityType: "Order",
    entityId: input.orderId,
    summary: `Marked ${order.reference} as paid (${PAYMENT_METHODS[input.method]}${amount !== null ? `, ${formatMoney(amount, order.currency)}` : ""})`,
    changes: { paymentStatus: { from: order.paymentStatus, to: "PAID" } },
  });
}

/** Undo a recorded payment. */
export async function markOrderUnpaid(input: { orderId: string; actor: AuditActor }) {
  const order = await db.order.findUnique({ where: { id: input.orderId }, select: { reference: true, paymentStatus: true } });
  if (!order) throw new OrderActionError("This order no longer exists.");
  await db.order.update({
    where: { id: input.orderId },
    data: { paymentStatus: "NOT_COLLECTED", paidAt: null, paidAmountCents: null, paymentProvider: null },
  });
  await logAudit({
    actor: input.actor,
    action: "order.unpaid",
    entityType: "Order",
    entityId: input.orderId,
    summary: `Marked ${order.reference} as not paid`,
    changes: { paymentStatus: { from: order.paymentStatus, to: "NOT_COLLECTED" } },
  });
}

// ── Promotion eligibility decisions ─────────────────────────────────────────

export async function decideOrderEligibility(input: {
  orderId: string;
  decision: "APPROVED" | "REJECTED";
  note?: string | null;
  actor: AuditActor;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const note = input.note?.trim() || null;
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        reference: true,
        status: true,
        promotionId: true,
        promotionName: true,
        customerId: true,
        discountCents: true,
        eligibilityStatus: true,
        eligibilityReasons: true,
        redemption: { select: { id: true } },
      },
    });
    if (!order) throw new OrderActionError("This order no longer exists.");
    if (!order.promotionId) throw new OrderActionError("This order didn't request a promotion.");

    const review = await tx.promotionEligibilityReview.findFirst({
      where: { orderId: order.id, promotionId: order.promotionId },
      orderBy: { createdAt: "desc" },
    });
    if (review) {
      await tx.promotionEligibilityReview.update({
        where: { id: review.id },
        data: { decision: input.decision, decidedById: input.actor.id, decidedAt: now, note },
      });
    } else {
      const automated: EligibilityStatus =
        order.eligibilityStatus === "APPROVED" || order.eligibilityStatus === "REJECTED" ? "NEEDS_REVIEW" : order.eligibilityStatus;
      await tx.promotionEligibilityReview.create({
        data: {
          orderId: order.id,
          promotionId: order.promotionId,
          automatedResult: automated,
          reasons: order.eligibilityReasons,
          decision: input.decision,
          decidedById: input.actor.id,
          decidedAt: now,
          note,
        },
      });
    }

    await tx.order.update({ where: { id: order.id }, data: { eligibilityStatus: input.decision } });

    // A cancelled order keeps its cancelled redemption (it doesn't count towards limits).
    const redemptionStatus = order.status === "CANCELLED" ? "CANCELLED" : input.decision;
    if (order.redemption) {
      await tx.promotionRedemption.update({
        where: { id: order.redemption.id },
        data: { status: redemptionStatus, decidedAt: now },
      });
    } else {
      await tx.promotionRedemption.create({
        data: {
          promotionId: order.promotionId,
          orderId: order.id,
          customerId: order.customerId,
          status: redemptionStatus,
          discountCents: order.discountCents,
          decidedAt: now,
        },
      });
    }
    return { reference: order.reference, promotionName: order.promotionName, previous: order.eligibilityStatus };
  });
  await logAudit({
    actor: input.actor,
    action: input.decision === "APPROVED" ? "order.promotion_approve" : "order.promotion_reject",
    entityType: "Order",
    entityId: input.orderId,
    summary: `${input.decision === "APPROVED" ? "Approved" : "Rejected"} ${result.promotionName ?? "promotion"} for ${result.reference}`,
    changes: { from: result.previous, to: input.decision, ...(note ? { note } : {}) },
  });
  return result;
}

// ── Detail ──────────────────────────────────────────────────────────────────

export async function getOrderDetail(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      plan: { select: { id: true, name: true, priceCents: true, archivedAt: true } },
      mealSelections: { orderBy: { sortOrder: "asc" }, select: { id: true, mealName: true, quantity: true } },
      promotion: { select: { id: true, name: true, slug: true, audience: true, endsAt: true } },
      deliveryArea: { select: { id: true, name: true } },
      collectionPoint: { select: { id: true, name: true } },
      statusHistory: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true, email: true } } } },
      internalNotes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true, email: true } } } },
      redemption: true,
      eligibilityReviews: {
        orderBy: { createdAt: "desc" },
        include: { decidedBy: { select: { name: true, email: true } } },
      },
      emails: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          toAddress: true,
          subject: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          lastError: true,
          sentAt: true,
          nextAttemptAt: true,
          createdAt: true,
          provider: true,
        },
      },
      attribution: true,
      customer: {
        select: {
          id: true,
          name: true,
          manualStatus: true,
          anonymizedAt: true,
          firstOrderAt: true,
          _count: { select: { orders: true } },
        },
      },
    },
  });
}

/** Summary of the customer's other orders (for the eligibility panel). */
export async function getCustomerHistorySummary(order: { id: string; customerId: string | null; customerEmail: string; customerPhone: string }) {
  const others = await db.order.findMany({
    where: {
      id: { not: order.id },
      OR: [
        ...(order.customerId ? [{ customerId: order.customerId }] : []),
        { customerEmail: { equals: order.customerEmail, mode: "insensitive" as const } },
        { customerPhone: order.customerPhone },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, reference: true, status: true, createdAt: true, planName: true, promotionName: true, eligibilityStatus: true },
  });
  const confirmed = others.filter((o) => ["CONFIRMED", "IN_PREPARATION", "COMPLETED"].includes(o.status)).length;
  const open = others.filter((o) => o.status === "NEW" || o.status === "CONTACTED").length;
  const withPromotion = others.filter((o) => o.promotionName).length;
  return { others, confirmed, open, withPromotion };
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Counts for the work queues (orders list tabs and dashboard). */
export async function orderQueueCounts() {
  const [toConfirm, unpaid] = await Promise.all([
    db.order.count({ where: { status: { in: ["NEW", "CONTACTED"] } } }),
    db.order.count({ where: { status: { in: GOING_AHEAD }, paymentStatus: { not: "PAID" } } }),
  ]);
  return { to_confirm: toConfirm, unpaid };
}
