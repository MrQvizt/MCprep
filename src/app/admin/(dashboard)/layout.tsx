import type { Metadata } from "next";
import { after } from "next/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_NAV } from "@/components/admin/nav-config";
import { AREA_ROLES, hasRole, requireAdmin, ROLE_LABELS } from "@/lib/authz";
import { db } from "@/lib/db";
import { processOutbox } from "@/lib/email/outbox";
import { signOutAction } from "../actions";

export const metadata: Metadata = {
  title: { default: "Admin | MC PREPS", template: "%s | MC PREPS Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("EDITOR");
  const groups = ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => hasRole(admin.role, AREA_ROLES[i.area])),
  })).filter((g) => g.items.length > 0);

  const badges: Record<string, number> = {};
  if (hasRole(admin.role, "ADMIN")) {
    badges["/admin/orders"] = await db.order.count({ where: { status: "NEW" } });
    // Opportunistic retry of queued emails (in addition to the cron job).
    after(() => processOutbox({ limit: 10 }).catch(() => undefined));
  }

  return (
    <AdminShell groups={groups} admin={{ name: admin.name, email: admin.email, roleLabel: ROLE_LABELS[admin.role] }} badges={badges} signOutAction={signOutAction}>
      {children}
    </AdminShell>
  );
}
