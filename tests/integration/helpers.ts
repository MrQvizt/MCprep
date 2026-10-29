import { db } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import type { AdminRole } from "@/generated/prisma/client";

/** Truncate every application table (fast reset between tests). */
export async function resetDatabase() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function disconnect() {
  await db.$disconnect();
}

export async function createAdmin(role: AdminRole = "OWNER", email = `${role.toLowerCase()}@mcpreps.test`) {
  return db.adminUser.create({
    data: { email, name: `${role} User`, role, passwordHash: await hashPassword("Test-Password-123") },
  });
}

/** Simulate a signed-in admin for code that calls auth(). */
export async function signInAs(role: AdminRole = "OWNER") {
  const admin = await createAdmin(role);
  globalThis.__testSession = { user: { id: admin.id, role: admin.role, sv: admin.sessionVersion, email: admin.email, name: admin.name } };
  return admin;
}

export function signOutTest() {
  globalThis.__testSession = null;
}

export async function createPlan(overrides: Partial<{ slug: string; name: string; priceCents: number | null; durationDays: number; isActive: boolean }> = {}) {
  const slug = overrides.slug ?? `plan-${Math.random().toString(36).slice(2, 8)}`;
  return db.plan.create({
    data: {
      slug,
      name: overrides.name ?? "2 Weeks",
      durationDays: overrides.durationDays ?? 14,
      priceCents: overrides.priceCents === undefined ? 12000 : overrides.priceCents,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function createPromotion(
  overrides: Partial<{
    slug: string;
    name: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number;
    audience: "ALL_CUSTOMERS" | "NEW_CUSTOMERS" | "SELECTED_CUSTOMERS";
    requiresCode: boolean;
    code: string | null;
    startsAt: Date;
    endsAt: Date;
    isEnabled: boolean;
    totalRedemptionLimit: number | null;
    perCustomerLimit: number | null;
    maxDiscountCents: number | null;
    appliesToAllPlans: boolean;
    planIds: string[];
  }> = {},
) {
  const now = Date.now();
  const { planIds, ...rest } = overrides;
  return db.promotion.create({
    data: {
      slug: rest.slug ?? `promo-${Math.random().toString(36).slice(2, 8)}`,
      name: rest.name ?? "Test Promotion",
      headline: "Test headline",
      discountType: rest.discountType ?? "PERCENTAGE",
      discountValue: rest.discountValue ?? 2000,
      audience: rest.audience ?? "ALL_CUSTOMERS",
      requiresCode: rest.requiresCode ?? false,
      code: rest.code ?? null,
      startsAt: rest.startsAt ?? new Date(now - 3_600_000),
      endsAt: rest.endsAt ?? new Date(now + 72 * 3_600_000),
      isEnabled: rest.isEnabled ?? true,
      totalRedemptionLimit: rest.totalRedemptionLimit ?? null,
      perCustomerLimit: rest.perCustomerLimit === undefined ? 1 : rest.perCustomerLimit,
      maxDiscountCents: rest.maxDiscountCents ?? null,
      appliesToAllPlans: rest.appliesToAllPlans ?? true,
      ...(planIds ? { eligiblePlans: { create: planIds.map((planId) => ({ planId })) } } : {}),
    },
  });
}

export async function createDeliveryArea(
  overrides: Partial<{ name: string; slug: string; deliveryAvailable: boolean; isPublished: boolean; deliveryFeeCents: number | null; minOrderCents: number | null }> = {},
) {
  const slug = overrides.slug ?? `area-${Math.random().toString(36).slice(2, 8)}`;
  return db.deliveryArea.create({
    data: {
      name: overrides.name ?? "Sliema",
      slug,
      deliveryAvailable: overrides.deliveryAvailable ?? true,
      isPublished: overrides.isPublished ?? true,
      deliveryFeeCents: overrides.deliveryFeeCents ?? null,
      minOrderCents: overrides.minOrderCents ?? null,
    },
  });
}
