"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, fdString, ok, zodFieldErrors, type ActionState } from "@/lib/actions";
import { endCustomerSession, getCurrentCustomer, safeNext, startCustomerSession } from "@/lib/customer-auth";
import {
  AccountError,
  authenticate,
  changePassword,
  claimOrder,
  createAccount,
  createPasswordReset,
  deleteAccount,
  resetPassword,
  updateProfile,
} from "@/lib/customer-accounts";
import { db } from "@/lib/db";
import { enqueueEmails, processOutbox } from "@/lib/email/outbox";
import { renderPasswordResetEmail } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/env";
import { normalizeEmail } from "@/lib/identity";
import { emailBrand } from "@/lib/orders/service";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { getSettings } from "@/lib/settings";

const email = z.string().trim().email("Enter a valid email address.").max(200);
const name = z.string().trim().min(2, "Enter your name.").max(120, "That name is too long.");

function accountError(error: unknown): ActionState {
  if (error instanceof AccountError) return fail(error.message, error.field ? { [error.field]: error.message } : undefined);
  console.error("[account] unexpected error", error);
  return fail("Something went wrong. Please try again.");
}

/** Optional order to save to the account straight after signing in or up (from the confirmation page). */
async function claimFromForm(accountId: string, fd: FormData) {
  const ref = fdString(fd, "claimRef");
  const token = fdString(fd, "claimToken");
  if (!ref || !token) return;
  await claimOrder(accountId, ref, token).catch(() => {});
}

// ── Sign up / in / out ──────────────────────────────────────────────────────

const signUpSchema = z.object({ name, email, password: z.string().max(200), phone: z.string().trim().max(30).optional() });

export async function signUpAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, 10, 3600)).ok) return fail("Too many new accounts from this connection. Please try again later.");
  const parsed = signUpSchema.safeParse({
    name: fdString(fd, "name"),
    email: fdString(fd, "email"),
    password: typeof fd.get("password") === "string" ? (fd.get("password") as string) : "",
    phone: fdString(fd, "phone") || undefined,
  });
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  let account;
  try {
    account = await createAccount(parsed.data);
    await startCustomerSession(account);
    await claimFromForm(account.id, fd);
  } catch (error) {
    return accountError(error);
  }
  redirect(safeNext(fdString(fd, "next"), "/account?welcome=1"));
}

export async function signInAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password.").max(200) }).safeParse({
    email: fdString(fd, "email"),
    password: typeof fd.get("password") === "string" ? (fd.get("password") as string) : "",
  });
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`account-login-ip:${ip}`, 20, 15 * 60),
    rateLimit(`account-login:${normalizeEmail(parsed.data.email)}`, 8, 15 * 60),
  ]);
  if (!byIp.ok || !byEmail.ok) return fail("Too many attempts. Please wait 15 minutes and try again.");
  try {
    const account = await authenticate(parsed.data.email, parsed.data.password);
    if (!account) return fail("That email and password don't match. Try again or reset your password.");
    await startCustomerSession(account);
    await claimFromForm(account.id, fd);
  } catch (error) {
    return accountError(error);
  }
  redirect(safeNext(fdString(fd, "next")));
}

export async function signOutAction(): Promise<void> {
  await endCustomerSession();
  redirect("/");
}

// ── Password reset ──────────────────────────────────────────────────────────

export async function requestPasswordResetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = email.safeParse(fdString(fd, "email"));
  if (!parsed.success) return fail("Please check the highlighted fields.", { email: "Enter a valid email address." });
  const address = normalizeEmail(parsed.data);
  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([rateLimit(`reset-ip:${ip}`, 10, 3600), rateLimit(`reset:${address}`, 3, 3600)]);
  // Same answer whether or not an account exists (no account discovery).
  const done = ok("If there's an account for that email, we've sent a link to reset the password. It works for one hour.");
  if (!byIp.ok || !byEmail.ok) return done;
  try {
    const account = await db.customerAccount.findUnique({ where: { email: address }, select: { id: true, name: true, email: true } });
    if (!account) return done;
    const token = await createPasswordReset(account.id);
    const settings = await getSettings();
    const message = renderPasswordResetEmail(emailBrand(settings), account.name, absoluteUrl(`/account/reset-password?token=${token}`));
    await enqueueEmails(db, [
      { type: "ACCOUNT_PASSWORD_RESET", dedupeKey: `reset:${account.id}:${token.slice(0, 12)}`, to: account.email, ...message },
    ]);
    after(() => processOutbox({ limit: 5 }).catch((e) => console.error("[account] reset email failed", e)));
  } catch (error) {
    console.error("[account] reset request failed", error);
  }
  return done;
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const token = fdString(fd, "token");
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  if (!(await rateLimit(`reset-use:${await clientIp()}`, 20, 3600)).ok) return fail("Too many attempts. Please try again later.");
  try {
    const account = await resetPassword(token, password);
    await startCustomerSession(account);
  } catch (error) {
    return accountError(error);
  }
  redirect("/account?reset=1");
}

// ── Signed-in actions ───────────────────────────────────────────────────────

async function requireSignedIn() {
  const customer = await getCurrentCustomer();
  if (!customer) throw new AccountError("Your session has ended. Please sign in again.");
  return customer;
}

export async function updateProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const customer = await requireSignedIn();
    const parsed = z.object({ name, phone: z.string().trim().max(30).optional() }).safeParse({
      name: fdString(fd, "name"),
      phone: fdString(fd, "phone") || undefined,
    });
    if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
    await updateProfile(customer.id, parsed.data);
    revalidatePath("/account");
    return ok("Details saved");
  } catch (error) {
    return accountError(error);
  }
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const customer = await requireSignedIn();
    if (!(await rateLimit(`account-pw:${customer.id}`, 10, 3600)).ok) return fail("Too many attempts. Please try again later.");
    const current = typeof fd.get("currentPassword") === "string" ? (fd.get("currentPassword") as string) : "";
    const next = typeof fd.get("newPassword") === "string" ? (fd.get("newPassword") as string) : "";
    const account = await changePassword(customer.id, current, next);
    await startCustomerSession(account); // keep this device signed in; others are signed out
    return ok("Password changed. Other devices have been signed out.");
  } catch (error) {
    return accountError(error);
  }
}

export async function deleteAccountAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const customer = await requireSignedIn();
    if (!(await rateLimit(`account-delete:${customer.id}`, 5, 3600)).ok) return fail("Too many attempts. Please try again later.");
    const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
    await deleteAccount(customer.id, password);
    await endCustomerSession();
  } catch (error) {
    return accountError(error);
  }
  redirect("/?account=deleted");
}

/** Save an order to the signed-in account using its private confirmation link. */
export async function claimOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const customer = await requireSignedIn();
    await claimOrder(customer.id, fdString(fd, "ref"), fdString(fd, "t"));
    revalidatePath("/account");
    return ok("Saved to your account");
  } catch (error) {
    return accountError(error);
  }
}
