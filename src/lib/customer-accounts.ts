import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/identity";
import { verifyConfirmationToken } from "@/lib/orders/service";
import { CUSTOMER_PASSWORD_MIN_LENGTH, hashPassword, passwordProblem as basePasswordProblem, verifyPassword } from "@/lib/passwords";

const passwordProblem = (p: string) => basePasswordProblem(p, CUSTOMER_PASSWORD_MIN_LENGTH);

export class AccountError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const RESET_TTL_MS = 60 * 60_000; // self-service email link: 1 hour
export const ADMIN_RESET_TTL_MS = 48 * 60 * 60_000; // link created by the team: 48 hours

function cleanPhone(phone: string | null | undefined): string | null {
  if (!phone || !phone.trim()) return null;
  const e164 = normalizePhone(phone);
  if (!e164) throw new AccountError("Enter a valid phone number, e.g. 7912 3456.", "phone");
  return e164;
}

export async function createAccount(input: { name: string; email: string; password: string; phone?: string | null }) {
  const email = normalizeEmail(input.email);
  const problem = passwordProblem(input.password);
  if (problem) throw new AccountError(problem, "password");
  const phone = cleanPhone(input.phone);
  if (await db.customerAccount.findUnique({ where: { email }, select: { id: true } })) {
    throw new AccountError("An account with this email already exists — sign in instead.", "email");
  }
  try {
    return await db.customerAccount.create({
      data: { email, name: input.name.trim(), phone, passwordHash: await hashPassword(input.password), lastLoginAt: new Date() },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AccountError("An account with this email already exists — sign in instead.", "email");
    }
    throw error;
  }
}

/** Account for valid credentials, else null (same timing either way). */
export async function authenticate(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const account = await db.customerAccount.findUnique({ where: { email } });
  const valid = await verifyPassword(password, account?.passwordHash);
  if (!account || !valid) return null;
  await db.customerAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
  return account;
}

export async function updateProfile(accountId: string, input: { name: string; phone?: string | null }) {
  return db.customerAccount.update({
    where: { id: accountId },
    data: { name: input.name.trim(), phone: cleanPhone(input.phone) },
  });
}

/** Change the password and sign out every other device (sessionVersion bump). */
export async function changePassword(accountId: string, current: string, next: string) {
  const account = await db.customerAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (!(await verifyPassword(current, account.passwordHash))) throw new AccountError("Your current password isn't right.", "currentPassword");
  const problem = passwordProblem(next);
  if (problem) throw new AccountError(problem, "newPassword");
  return db.customerAccount.update({
    where: { id: accountId },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
  });
}

/** One-time password reset link token (only its hash is stored). */
export async function createPasswordReset(accountId: string, opts: { createdById?: string | null; ttlMs?: number } = {}) {
  const token = randomBytes(32).toString("base64url");
  await db.customerPasswordReset.create({
    data: {
      accountId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + (opts.ttlMs ?? RESET_TTL_MS)),
      createdById: opts.createdById ?? null,
    },
  });
  return token;
}

/** Check a reset token without using it (for showing the form). */
export async function findValidReset(token: string | null | undefined) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const reset = await db.customerPasswordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { account: { select: { id: true, email: true, name: true } } },
  });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) return null;
  return reset;
}

/** Set a new password with a reset token; revokes every session. Returns the account. */
export async function resetPassword(token: string, password: string) {
  const problem = passwordProblem(password);
  if (problem) throw new AccountError(problem, "password");
  const reset = await findValidReset(token);
  if (!reset) throw new AccountError("This reset link has expired or was already used. Ask for a new one.");
  return db.$transaction(async (tx) => {
    const used = await tx.customerPasswordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new AccountError("This reset link was already used. Ask for a new one.");
    await tx.customerPasswordReset.deleteMany({ where: { accountId: reset.accountId, usedAt: null } });
    return tx.customerAccount.update({
      where: { id: reset.accountId },
      data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
    });
  });
}

/**
 * Link an order to the account. Requires the order's private confirmation
 * token, so knowing someone's email or order reference is never enough.
 */
export async function claimOrder(accountId: string, reference: string, token: string) {
  const order = await db.order.findUnique({
    where: { reference: reference.slice(0, 20) },
    select: { id: true, idempotencyKey: true, accountId: true, confirmationExpiresAt: true },
  });
  if (!order || !verifyConfirmationToken(order, token)) throw new AccountError("We couldn't find that order.");
  if (order.confirmationExpiresAt && order.confirmationExpiresAt.getTime() < Date.now()) {
    throw new AccountError("This order link has expired. Message us and we'll add the order to your account.");
  }
  if (order.accountId && order.accountId !== accountId) throw new AccountError("This order is already saved to another account.");
  if (!order.accountId) await db.order.update({ where: { id: order.id }, data: { accountId } });
  return order.id;
}

/** Delete the account (password confirmed). Orders stay with the business, unlinked. */
export async function deleteAccount(accountId: string, password: string) {
  const account = await db.customerAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (!(await verifyPassword(password, account.passwordHash))) throw new AccountError("That password isn't right.", "password");
  await db.customerAccount.delete({ where: { id: accountId } });
}

export async function getAccountOrders(accountId: string) {
  return db.order.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      reference: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      planName: true,
      planMealsPerWeek: true,
      planIsSubscription: true,
      currency: true,
      totalCents: true,
      confirmedTotalCents: true,
      fulfillmentMethod: true,
      preferredStartDate: true,
      plan: { select: { slug: true, isActive: true, archivedAt: true } },
      mealSelections: { orderBy: { sortOrder: "asc" }, select: { mealName: true, quantity: true, meal: { select: { slug: true, isPublished: true, archivedAt: true } } } },
    },
  });
}
