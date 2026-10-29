import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { AreaForm } from "../../area-form";

export const metadata = { title: "Add delivery locality" };

export default async function NewAreaPage() {
  await requireAdmin(AREA_ROLES.delivery);
  return (
    <>
      <AdminPageHeader title="Add delivery locality" back={{ href: "/admin/delivery", label: "Delivery & collection" }} />
      <AreaForm />
    </>
  );
}
