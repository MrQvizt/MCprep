import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { CollectionForm } from "../../collection-form";

export const metadata = { title: "Add collection point" };

export default async function NewCollectionPointPage() {
  await requireAdmin(AREA_ROLES.delivery);
  return (
    <>
      <AdminPageHeader title="Add collection point" back={{ href: "/admin/delivery", label: "Delivery & collection" }} />
      <CollectionForm />
    </>
  );
}
