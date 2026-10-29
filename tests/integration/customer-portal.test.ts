import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { adminCreatePasswordResetLink, adminDeleteWebsiteAccount, findWebsiteAccounts } from "@/lib/admin/customer-accounts";
import { anonymizeCustomer, exportCustomerData } from "@/lib/admin/customers";
import {
  AccountError,
  authenticate,
  changePassword,
  claimOrder,
  createAccount,
  createPasswordReset,
  deleteAccount,
  findValidReset,
  getAccountOrders,
  resetPassword,
  updateProfile,
} from "@/lib/customer-accounts";
import { db } from "@/lib/db";
import { orderRequestSchema } from "@/lib/orders/schema";
import { evenSplit } from "@/lib/packages";
import { createOrderRequest } from "@/lib/orders/service";
import { verifyPassword } from "@/lib/passwords";
import { applyReleases } from "../../prisma/releases";
import { createAdmin } from "./helpers";

const PASSWORD = "Meal-prep-2026";

async function account(email = "anna@example.com") {
  return createAccount({ name: "Anna Camilleri", email, password: PASSWORD, phone: "7912 3456" });
}

async function order(email = "anna@example.com", accountId?: string) {
  await applyReleases(db, () => {});
  const meals = await db.meal.findMany({ where: { isPublished: true }, orderBy: { sortOrder: "asc" } });
  const input = orderRequestSchema.parse({
    mealSelections: evenSplit(
      meals.map((m) => m.id),
      5,
    ),
    idempotencyKey: randomUUID(),
    planSlug: "lunch-5-days",
    fullName: "Anna Camilleri",
    email,
    phone: "7912 3456",
    fulfillmentMethod: "COLLECTION",
    privacyAccepted: true,
    firstOrderDeclared: false,
    allergyConsent: false,
    marketingOptIn: false,
  });
  const result = await createOrderRequest(input, { accountId });
  const token = new URL(result.confirmationUrl, "https://x.test").searchParams.get("t")!;
  return { ...result, token };
}

async function accountError(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AccountError);
  return error as AccountError;
}

describe("customer accounts", () => {
  it("creates an account with a normalised email, hashed password and E.164 phone", async () => {
    const a = await createAccount({ name: " Anna Camilleri ", email: " Anna@Example.com ", password: PASSWORD, phone: "7912 3456" });
    expect(a).toMatchObject({ email: "anna@example.com", name: "Anna Camilleri", phone: "+35679123456" });
    expect(a.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, a.passwordHash)).toBe(true);

    expect((await accountError(account("ANNA@example.com"))).field).toBe("email");
    expect((await accountError(createAccount({ name: "B", email: "b@example.com", password: "short1" }))).field).toBe("password");
    expect((await accountError(createAccount({ name: "B", email: "b@example.com", password: PASSWORD, phone: "12" }))).field).toBe("phone");
  });

  it("signs in only with the right password", async () => {
    await account();
    expect(await authenticate("anna@example.com", "wrong-password-1")).toBeNull();
    expect(await authenticate("nobody@example.com", PASSWORD)).toBeNull();
    const ok = await authenticate("ANNA@example.com", PASSWORD);
    expect(ok?.lastLoginAt).toBeInstanceOf(Date);
  });

  it("changes the password only with the current one, and signs other devices out", async () => {
    const a = await account();
    expect((await accountError(changePassword(a.id, "wrong-password-1", "New-password-22"))).field).toBe("currentPassword");
    expect((await accountError(changePassword(a.id, PASSWORD, "short"))).field).toBe("newPassword");
    const updated = await changePassword(a.id, PASSWORD, "New-password-22");
    expect(updated.sessionVersion).toBe(a.sessionVersion + 1);
    expect(await authenticate(a.email, "New-password-22")).not.toBeNull();
  });

  it("updates name and phone", async () => {
    const a = await account();
    expect(await updateProfile(a.id, { name: "Anna C", phone: "" })).toMatchObject({ name: "Anna C", phone: null });
  });

  it("reset links work once, expire, and revoke every session", async () => {
    const a = await account();
    const token = await createPasswordReset(a.id);
    const stored = await db.customerPasswordReset.findFirstOrThrow({ where: { accountId: a.id } });
    expect(stored.tokenHash).not.toBe(token); // only the hash is stored
    expect(await findValidReset(token)).not.toBeNull();
    expect(await findValidReset("x".repeat(43))).toBeNull();

    const other = await createPasswordReset(a.id);
    const updated = await resetPassword(token, "Reset-password-33");
    expect(updated.sessionVersion).toBe(a.sessionVersion + 1);
    expect(await authenticate(a.email, "Reset-password-33")).not.toBeNull();
    await accountError(resetPassword(token, "Again-password-44")); // used
    await accountError(resetPassword(other, "Again-password-44")); // other open links are cancelled

    const expired = await createPasswordReset(a.id, { ttlMs: -1 });
    expect(await findValidReset(expired)).toBeNull();
  });

  it("saves an order to an account only with its private confirmation token", async () => {
    const a = await account();
    const o = await order();
    await accountError(claimOrder(a.id, o.reference, "not-the-token"));
    await claimOrder(a.id, o.reference, o.token);
    await claimOrder(a.id, o.reference, o.token); // idempotent
    const orders = await getAccountOrders(a.id);
    expect(orders.map((x) => x.reference)).toEqual([o.reference]);
    expect(orders[0].plan?.slug).toBe("lunch-5-days");
    expect(orders[0].mealSelections.reduce((n, m) => n + m.quantity, 0)).toBe(5);

    const b = await account("someone.else@example.com");
    expect((await accountError(claimOrder(b.id, o.reference, o.token))).message).toMatch(/another account/);
  });

  it("links orders placed while signed in", async () => {
    const a = await account();
    const o = await order("different.address@example.com", a.id);
    expect((await getAccountOrders(a.id)).map((x) => x.reference)).toEqual([o.reference]);
  });

  it("deleting an account needs the password and keeps the orders", async () => {
    const a = await account();
    const o = await order("anna@example.com", a.id);
    expect((await accountError(deleteAccount(a.id, "wrong-password-1"))).field).toBe("password");
    await deleteAccount(a.id, PASSWORD);
    expect(await db.customerAccount.findUnique({ where: { id: a.id } })).toBeNull();
    expect(await db.order.findUniqueOrThrow({ where: { id: o.orderId } })).toMatchObject({ accountId: null });
  });
});

describe("website accounts in the admin", () => {
  it("finds the login for a customer, creates a 48-hour reset link and can delete it", async () => {
    const admin = await createAdmin("ADMIN");
    const a = await account();
    const o = await order();
    const customer = await db.customer.findFirstOrThrow({ include: { orders: { select: { id: true } } } });
    const found = await findWebsiteAccounts({ email: customer.email, orderIds: customer.orders.map((x) => x.id) });
    expect(found.map((x) => x.id)).toEqual([a.id]);

    const url = await adminCreatePasswordResetLink({ accountId: a.id, customerId: customer.id, actor: admin });
    expect(url).toMatch(/^https:\/\/mcpreps\.test\/account\/reset-password\?token=/);
    const reset = await db.customerPasswordReset.findFirstOrThrow({ where: { accountId: a.id } });
    expect(reset.createdById).toBe(admin.id);
    expect(reset.expiresAt.getTime() - Date.now()).toBeGreaterThan(47 * 3600_000);
    expect(await db.auditLog.count({ where: { entityId: customer.id, action: "customer.account_reset_link" } })).toBe(1);

    const exported = await exportCustomerData(customer.id);
    expect(exported?.websiteAccounts).toMatchObject([{ email: "anna@example.com" }]);
    expect(JSON.stringify(exported)).not.toContain("passwordHash");

    await adminDeleteWebsiteAccount({ accountId: a.id, customerId: customer.id, actor: admin });
    expect(await db.customerAccount.count()).toBe(0);
    expect(await db.order.count({ where: { id: o.orderId } })).toBe(1);
  });

  it("lists every login whose orders belong to the customer (matched by phone)", async () => {
    const a = await account("first@example.com");
    const b = await account("second@example.com");
    await order("first@example.com", a.id);
    await order("second@example.com", b.id); // same phone → same customer record
    const customers = await db.customer.findMany({ include: { orders: { select: { id: true } } } });
    expect(customers).toHaveLength(1);
    const found = await findWebsiteAccounts({ email: customers[0].email, orderIds: customers[0].orders.map((x) => x.id) });
    expect(found.map((x) => x.email).sort()).toEqual(["first@example.com", "second@example.com"]);
  });

  it("removing a customer's personal data also removes their website login", async () => {
    const admin = await createAdmin("ADMIN");
    const a = await account();
    await order("anna@example.com", a.id);
    const customer = await db.customer.findFirstOrThrow();
    await anonymizeCustomer({ customerId: customer.id, actor: admin });
    expect(await db.customerAccount.findUnique({ where: { id: a.id } })).toBeNull();
    expect(await db.customerSession.count()).toBe(0);
  });
});
