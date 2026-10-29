import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { getSettingsGroup } from "@/lib/settings";
import { GalleryForm } from "../gallery-form";

export const metadata = { title: "Add gallery photo" };

export default async function NewGalleryItemPage() {
  await requireAdmin(AREA_ROLES.gallery);
  const contact = await getSettingsGroup("contact");
  return (
    <>
      <AdminPageHeader title="Add gallery photo" back={{ href: "/admin/gallery", label: "Instagram gallery" }} />
      <GalleryForm profileUrl={contact.instagramUrl} />
    </>
  );
}
