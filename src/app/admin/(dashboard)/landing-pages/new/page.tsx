import { AdminPageHeader } from "@/components/admin/page-header";
import { LANDING_EXPIRED_LABELS, LANDING_TYPE_LABELS } from "@/lib/admin/landing-pages";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { LandingForm } from "../landing-form";
import { landingFormOptions } from "../shared";

export const metadata = { title: "New offer page" };

export default async function NewLandingPage() {
  await requireAdmin(AREA_ROLES.promotions);
  const options = await landingFormOptions();
  return (
    <>
      <AdminPageHeader title="New offer page" back={{ href: "/admin/landing-pages", label: "All offer pages" }} />
      <LandingForm {...options} types={LANDING_TYPE_LABELS} expiredOptions={LANDING_EXPIRED_LABELS} />
    </>
  );
}
