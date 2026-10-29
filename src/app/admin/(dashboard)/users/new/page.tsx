import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { NewUserForm } from "../user-forms";

export const metadata = { title: "Add admin user" };

export default async function NewUserPage() {
  await requireAdmin(AREA_ROLES.users);
  return (
    <>
      <AdminPageHeader title="Add admin user" back={{ href: "/admin/users", label: "Admin users" }} />
      <AdminCard>
        <NewUserForm />
      </AdminCard>
    </>
  );
}
