"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, fdOptional, fdString, handleActionError, ok, type ActionState } from "@/lib/actions";
import {
  addOrderNote,
  changeOrderStatus,
  decideOrderEligibility,
  isOrderStatus,
  markOrderPaid,
  markOrderUnpaid,
  OrderActionError,
  PAYMENT_STATUSES,
  updateOrderPricePayment,
} from "@/lib/admin/orders";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { processOutbox, requeueEmail } from "@/lib/email/outbox";
import { parseMoneyToCents } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/orders/labels";
import type { OrderStatus } from "@/generated/prisma/client";

function refresh(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

function orderError(error: unknown): ActionState {
  if (error instanceof OrderActionError) return fail(error.message);
  return handleActionError(error);
}

/** One-click status change (quick action buttons). */
export async function quickOrderStatus(orderId: string, toStatus: OrderStatus): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.orders);
    if (!isOrderStatus(toStatus)) return fail("Unknown status.");
    await changeOrderStatus({ orderId, toStatus, actor: admin });
    refresh(orderId);
    return ok(`Marked as “${ORDER_STATUS_LABELS[toStatus]}”`);
  } catch (error) {
    return orderError(error);
  }
}

/** One click: record that the customer paid, and how. */
export async function quickMarkPaid(orderId: string, method: PaymentMethod): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.orders);
    if (!(method in PAYMENT_METHODS)) return fail("Choose how the customer paid.");
    await markOrderPaid({ orderId, method, actor: admin });
    refresh(orderId);
    return ok(`Marked as paid (${PAYMENT_METHODS[method]})`);
  } catch (error) {
    return orderError(error);
  }
}

/** Undo a recorded payment. */
export async function quickMarkUnpaid(orderId: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.orders);
    await markOrderUnpaid({ orderId, actor: admin });
    refresh(orderId);
    return ok("Marked as not paid");
  } catch (error) {
    return orderError(error);
  }
}

const statusSchema = z.object({
  status: z.string().refine(isOrderStatus, "Choose a status."),
  note: z.string().max(1000, "Keep the note under 1,000 characters.").optional(),
});

export async function updateOrderStatusAction(orderId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.orders);
    const data = statusSchema.parse({ status: fdString(fd, "status"), note: fdString(fd, "note") || undefined });
    await changeOrderStatus({ orderId, toStatus: data.status as OrderStatus, note: data.note, actor: admin });
    refresh(orderId);
    return ok("Status updated");
  } catch (error) {
    return orderError(error);
  }
}

const noteSchema = z.object({
  body: z.string().trim().min(1, "Write a note first.").max(4000, "Keep notes under 4,000 characters."),
});

export async function addOrderNoteAction(orderId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.orders);
    const data = noteSchema.parse({ body: fdString(fd, "body") });
    await addOrderNote({ orderId, body: data.body, actor: admin });
    refresh(orderId);
    return ok("Note added");
  } catch (error) {
    return orderError(error);
  }
}

const pricePaymentSchema = z.object({
  confirmedTotal: z.string().max(20),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  paidAmount: z.string().max(20),
});

export async function updatePricePaymentAction(orderId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.orders);
    const data = pricePaymentSchema.parse({
      confirmedTotal: fdString(fd, "confirmedTotal"),
      paymentStatus: fdString(fd, "paymentStatus"),
      paidAmount: fdString(fd, "paidAmount"),
    });
    const confirmedTotalCents = data.confirmedTotal ? parseMoneyToCents(data.confirmedTotal) : null;
    if (data.confirmedTotal && confirmedTotalCents === null) {
      return fail("Please check the highlighted fields.", { confirmedTotal: "Enter an amount like 95 or 95.50." });
    }
    const paidAmountCents = data.paidAmount ? parseMoneyToCents(data.paidAmount) : null;
    if (data.paidAmount && paidAmountCents === null) {
      return fail("Please check the highlighted fields.", { paidAmount: "Enter an amount like 95 or 95.50." });
    }
    await updateOrderPricePayment({
      orderId,
      confirmedTotalCents,
      paymentStatus: data.paymentStatus,
      paidAmountCents,
      actor: admin,
    });
    refresh(orderId);
    return ok("Price and payment saved");
  } catch (error) {
    return orderError(error);
  }
}

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"], { message: "Choose approve or reject." }),
  note: z.string().max(1000).optional(),
});

export async function decideEligibilityAction(orderId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.orders);
    const data = decisionSchema.parse({ decision: fdString(fd, "decision"), note: fdOptional(fd, "note") ?? undefined });
    await decideOrderEligibility({ orderId, decision: data.decision, note: data.note, actor: admin });
    refresh(orderId);
    return ok(data.decision === "APPROVED" ? "Promotion approved for this order" : "Promotion rejected for this order");
  } catch (error) {
    return orderError(error);
  }
}

/** Put an order email back in the queue and try to send it immediately. */
export async function retryOrderEmail(emailId: string): Promise<ActionState> {
  try {
    await assertAdmin(AREA_ROLES.orders);
    const email = await db.emailOutbox.findUnique({ where: { id: emailId }, select: { id: true, orderId: true, status: true } });
    if (!email) return fail("This email no longer exists.");
    if (email.status === "SENT") return fail("This email was already sent.");
    await requeueEmail(email.id);
    const result = await processOutbox({ ids: [email.id], limit: 1 });
    if (email.orderId) refresh(email.orderId);
    if (result.skipped === "disabled") return fail("Email sending isn't configured yet, so the email stays queued. See Business settings.");
    if (result.sent > 0) return ok("Email sent");
    return fail("Sending failed again — it will be retried automatically. Check the error below.");
  } catch (error) {
    return orderError(error);
  }
}
