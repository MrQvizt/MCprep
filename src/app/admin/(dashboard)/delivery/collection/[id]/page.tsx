import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { CollectionForm } from "../../collection-form";

export const metadata = { title: "Edit collection point" };

export default async function EditCollectionPointPage({ params }: PageProps<"/admin/delivery/collection/[id]">) {
  await requireAdmin(AREA_ROLES.delivery);
  const { id } = await params;
  const point = await db.collectionPoint.findUnique({ where: { id } });
  if (!point) notFound();
  return (
    <>
      <AdminPageHeader title={point.name} back={{ href: "/admin/delivery", label: "Delivery & collection" }} />
      <CollectionForm point={point} />
    </>
  );
}
