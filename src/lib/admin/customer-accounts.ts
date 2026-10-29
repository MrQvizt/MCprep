import "server-only";
import { logAudit, type AuditActor } from "@/lib/audit";
import { ADMIN_RESET_TTL_MS, createPasswordReset } from "@/lib/customer-accounts";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/env";
import { normalizeEmail } from "@/lib/identity";
import { OrderActionError } from "./orders";

/**
 * Website logins (customer portal accounts) that belong to a customer record:
 * same email, or the account their orders are saved to. Usually one, but a
 * customer matched by phone can have orders from more than one login.
 */
export async function findWebsiteAccounts(customer: { email: string | null; orderIds: string[] }) {
  const or = [
    ...(customer.email ? [{ email: normalizeEmail(customer.email) }] : []),
    ...(customer.orderIds.length ? [{ orders: { some: { id: { in: customer.orderIds } } } }] : []),
  ];
  if (or.length === 0) return [];
  return db.customerAccount.findMany({
    where: { OR: or },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { orders: true } },
    },
  });
}

/** One-time link (valid 48 hours) the team can send a customer who can't get into their account. */
export async function adminCreatePasswordResetLink(input: { accountId: string; customerId: string; actor: AuditActor }) {
  const account = await db.customerAccount.findUnique({ where: { id: input.accountId }, select: { id: true, email: true } });
  if (!account) throw new OrderActionError("This website account no longer exists.");
  const token = await createPasswordReset(account.id, { createdById: input.actor.id, ttlMs: ADMIN_RESET_TTL_MS });
  await logAudit({
    actor: input.actor,
    action: "customer.account_reset_link",
    entityType: "Customer",
    entityId: input.customerId,
    summary: "Created a password reset link for their website account",
  });
  return absoluteUrl(`/account/reset-password?token=${token}`);
}

/** Remove the login. Orders stay (unlinked). */
export async function adminDeleteWebsiteAccount(input: { accountId: string; customerId: string; actor: AuditActor }) {
  const deleted = await db.customerAccount.deleteMany({ where: { id: input.accountId } });
  if (deleted.count === 0) throw new OrderActionError("This website account no longer exists.");
  await logAudit({
    actor: input.actor,
    action: "customer.account_delete",
    entityType: "Customer",
    entityId: input.customerId,
    summary: "Deleted their website account (orders kept)",
  });
}
