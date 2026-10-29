import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { AREA_ROLES, requireAdmin, ROLE_LABELS } from "@/lib/authz";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { setUserActiveAction } from "../actions";
import { EditUserForm, ResetPasswordForm } from "../user-forms";

export const metadata = { title: "Admin user" };

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireAdmin(AREA_ROLES.users);
  const { id } = await params;
  const [user, settings, recent] = await Promise.all([
    db.adminUser.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    }),
    getSettings(),
    db.auditLog.findMany({ where: { actorId: id }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, summary: true, createdAt: true } }),
  ]);
  if (!user) notFound();
  const isSelf = user.id === me.id;
  const tz = settings.business.timeZone;

  return (
    <>
      <AdminPageHeader
        title={user.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {user.email} <StatusBadge tone={user.isActive ? "good" : "bad"}>{user.isActive ? "Active" : "Deactivated"}</StatusBadge>
            <StatusBadge>{ROLE_LABELS[user.role]}</StatusBadge>
          </span>
        }
        back={{ href: "/admin/users", label: "Admin users" }}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="Details">
          <EditUserForm user={user} isSelf={isSelf} />
        </AdminCard>
        <div className="space-y-6">
          <AdminCard title="Access">
            <dl className="mb-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd className="font-medium">{user.lastLoginAt ? formatDateTime(user.lastLoginAt, tz) : "Never"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account created</dt>
                <dd className="font-medium">{formatDateTime(user.createdAt, tz)}</dd>
              </div>
            </dl>
            {isSelf ? (
              <p className="text-sm text-muted-foreground">
                This is your account. Change your password on{" "}
                <Link href="/admin/account" className="underline underline-offset-4">
                  My account
                </Link>
                .
              </p>
            ) : user.isActive ? (
              <ConfirmAction
                action={setUserActiveAction.bind(null, user.id, false)}
                title={`Deactivate ${user.name}?`}
                description="They are signed out immediately and can't sign in again until reactivated. Their past activity stays in the log."
                confirmLabel="Deactivate"
                destructive
              >
                Deactivate account
              </ConfirmAction>
            ) : (
              <ConfirmAction
                action={setUserActiveAction.bind(null, user.id, true)}
                title={`Reactivate ${user.name}?`}
                description="They will be able to sign in again with their password."
                confirmLabel="Reactivate"
              >
                Reactivate account
              </ConfirmAction>
            )}
          </AdminCard>
          {!isSelf && (
            <AdminCard title="Reset password">
              <ResetPasswordForm userId={user.id} />
            </AdminCard>
          )}
          <AdminCard title="Recent activity">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recorded changes yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recent.map((r) => (
                  <li key={r.id}>
                    <span className="text-muted-foreground">{formatDateTime(r.createdAt, tz)}</span> — {r.summary}
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/admin/audit?actor=${user.id}`} className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
              Full activity log
            </Link>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
