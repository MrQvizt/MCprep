import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { MEDIA_SELECT } from "@/lib/media";
import { getSettingsGroup } from "@/lib/settings";
import { GalleryForm } from "../gallery-form";

export const metadata = { title: "Edit gallery photo" };

export default async function EditGalleryItemPage({ params }: PageProps<"/admin/gallery/[id]">) {
  await requireAdmin(AREA_ROLES.gallery);
  const { id } = await params;
  const [item, contact] = await Promise.all([
    db.galleryItem.findUnique({ where: { id }, include: { mediaAsset: { select: MEDIA_SELECT } } }),
    getSettingsGroup("contact"),
  ]);
  if (!item) notFound();
  return (
    <>
      <AdminPageHeader title="Edit gallery photo" back={{ href: "/admin/gallery", label: "Instagram gallery" }} />
      <GalleryForm profileUrl={contact.instagramUrl} item={{ ...item, media: item.mediaAsset }} />
    </>
  );
}
