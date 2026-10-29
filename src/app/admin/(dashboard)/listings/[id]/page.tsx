import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { zonedDateString } from "@/lib/time";
import { ListingForm } from "../forms";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: PageProps<"/admin/listings/[id]">) {
  await requireAdmin(AREA_ROLES.listings);
  const { id } = await params;
  const l = await db.businessListing.findUnique({ where: { id } });
  if (!l) notFound();
  return (
    <>
      <AdminPageHeader title={l.platform} back={{ href: "/admin/listings", label: "Google & listings" }} />
      <ListingForm
        defaultDetails=""
        listing={{
          id: l.id,
          platform: l.platform,
          url: l.url,
          status: l.status,
          submittedAt: l.submittedAt ? zonedDateString(l.submittedAt) : "",
          lastCheckedAt: l.lastCheckedAt ? zonedDateString(l.lastCheckedAt) : "",
          detailsUsed: l.detailsUsed,
          notes: l.notes,
        }}
      />
    </>
  );
}
