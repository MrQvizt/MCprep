import "server-only";
import { cache } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { AdminRole } from "@/generated/prisma/client";

export type { AdminRole };

export const ROLE_RANK: Record<AdminRole, number> = { EDITOR: 1, ADMIN: 2, OWNER: 3 };

export const ROLE_LABELS: Record<AdminRole, string> = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  EDITOR: "Content editor",
};

export interface CurrentAdmin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export class AuthorizationError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function hasRole(role: AdminRole, minRole: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/**
 * The signed-in, active administrator — or null. Re-checks the database on
 * every request so deactivated accounts and password changes take effect
 * immediately (session version must match).
 */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  let session: Session | null;
  try {
    session = await auth();
  } catch (error) {
    // Let Next.js internal signals (dynamic rendering, redirects) propagate.
    unstable_rethrow(error);
    // e.g. AUTH_SECRET missing — treat as signed out rather than breaking public pages.
    console.error("[auth] could not read session", error);
    return null;
  }
  const id = session?.user?.id;
  if (!session || !id) return null;
  const user = await db.adminUser.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, isActive: true, sessionVersion: true },
  });
  if (!user || !user.isActive || user.sessionVersion !== session.user.sv) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
});

/** For admin pages/layouts: redirects to login (or the dashboard) when not allowed. */
export async function requireAdmin(minRole: AdminRole = "EDITOR"): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (!hasRole(admin.role, minRole)) redirect("/admin?denied=1");
  return admin;
}

/** For server actions and route handlers: throws AuthorizationError instead of redirecting. */
export async function assertAdmin(minRole: AdminRole = "EDITOR"): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new AuthorizationError("Your session has expired. Please sign in again.");
  if (!hasRole(admin.role, minRole)) throw new AuthorizationError();
  return admin;
}

/** Minimum role required for each admin area (used by nav + guards). */
export const AREA_ROLES = {
  dashboard: "EDITOR",
  orders: "ADMIN",
  customers: "ADMIN",
  growth: "ADMIN",
  meals: "EDITOR",
  plans: "ADMIN",
  promotions: "ADMIN",
  media: "EDITOR",
  gallery: "EDITOR",
  content: "EDITOR",
  faqs: "EDITOR",
  testimonials: "EDITOR",
  blog: "EDITOR",
  seo: "EDITOR",
  redirects: "EDITOR",
  listings: "ADMIN",
  delivery: "ADMIN",
  settings: "ADMIN",
  launch: "ADMIN",
  health: "EDITOR",
  audit: "ADMIN",
  users: "OWNER",
  account: "EDITOR",
} as const satisfies Record<string, AdminRole>;

export type AdminArea = keyof typeof AREA_ROLES;
