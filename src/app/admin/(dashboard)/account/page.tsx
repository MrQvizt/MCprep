import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { ROLE_DESCRIPTIONS } from "@/lib/admin/users";
import { AREA_ROLES, requireAdmin, ROLE_LABELS } from "@/lib/authz";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { PasswordForm, ProfileForm } from "./account-forms";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireAdmin(AREA_ROLES.account);
  const [user, settings] = await Promise.all([
    db.adminUser.findUniqueOrThrow({ where: { id: me.id }, select: { name: true, email: true, role: true, lastLoginAt: true, createdAt: true } }),
    getSettings(),
  ]);
  const tz = settings.business.timeZone;
  return (
    <>
      <AdminPageHeader title="My account" description="Your profile and password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AdminCard title="Profile">
            <ProfileForm name={user.name} email={user.email} />
          </AdminCard>
          <AdminCard title="Your access">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="mt-1">
                  <StatusBadge tone="dark">{ROLE_LABELS[user.role]}</StatusBadge>
                  <span className="ml-2 text-muted-foreground">{ROLE_DESCRIPTIONS[user.role]}</span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd className="mt-1 font-medium">{user.lastLoginAt ? formatDateTime(user.lastLoginAt, tz) : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account created</dt>
                <dd className="mt-1 font-medium">{formatDateTime(user.createdAt, tz)}</dd>
              </div>
            </dl>
          </AdminCard>
        </div>
        <AdminCard title="Change password">
          <PasswordForm />
        </AdminCard>
      </div>
    </>
  );
}
