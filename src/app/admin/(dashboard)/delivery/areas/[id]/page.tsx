import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { AreaForm } from "../../area-form";

export const metadata = { title: "Edit delivery locality" };

export default async function EditAreaPage({ params }: PageProps<"/admin/delivery/areas/[id]">) {
  await requireAdmin(AREA_ROLES.delivery);
  const { id } = await params;
  const area = await db.deliveryArea.findUnique({ where: { id } });
  if (!area) notFound();
  return (
    <>
      <AdminPageHeader
        title={area.name}
        description={area.hasPublicPage ? `Locality page: /delivery-areas/${area.slug}` : "Delivery locality"}
        back={{ href: "/admin/delivery", label: "Delivery & collection" }}
      />
      <AreaForm area={area} />
    </>
  );
}
