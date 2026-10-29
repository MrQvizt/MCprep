import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_DESCRIPTIONS } from "@/lib/admin/users";
import { AREA_ROLES, requireAdmin, ROLE_LABELS } from "@/lib/authz";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Admin users" };

export default async function UsersPage() {
  const me = await requireAdmin(AREA_ROLES.users);
  const [users, settings] = await Promise.all([
    db.adminUser.findMany({
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    }),
    getSettings(),
  ]);
  const tz = settings.business.timeZone;

  return (
    <>
      <AdminPageHeader
        title="Admin users"
        description="Who can sign in to this admin portal. Give each person their own account and the smallest role they need."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/users/new">
              <Plus className="size-4" /> Add user
            </Link>
          </Button>
        }
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Role</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden lg:table-cell">Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                    {u.name}
                  </Link>
                  {u.id === me.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <StatusBadge tone={u.role === "OWNER" ? "dark" : u.role === "ADMIN" ? "info" : "neutral"}>{ROLE_LABELS[u.role]}</StatusBadge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge tone={u.isActive ? "good" : "bad"}>{u.isActive ? "Active" : "Deactivated"}</StatusBadge>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt, tz) : "Never"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
        {(["OWNER", "ADMIN", "EDITOR"] as const).map((r) => (
          <div key={r} className="rounded-lg border bg-card p-4">
            <dt className="font-semibold">{ROLE_LABELS[r]}</dt>
            <dd className="mt-1 text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
