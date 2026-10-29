import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { getSettings } from "@/lib/settings";
import { canonicalBusinessDetails, detailsAsText } from "../business-details";
import { ListingForm } from "../forms";

export const metadata = { title: "Add listing" };

export default async function NewListingPage() {
  await requireAdmin(AREA_ROLES.listings);
  const settings = await getSettings();
  return (
    <>
      <AdminPageHeader title="Add a listing" back={{ href: "/admin/listings", label: "Google & listings" }} />
      <ListingForm defaultDetails={detailsAsText(canonicalBusinessDetails(settings))} />
    </>
  );
}
