import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { PlanForm } from "../plan-form";

export const metadata = { title: "New plan" };

export default async function NewPlanPage() {
  await requireAdmin(AREA_ROLES.plans);
  return (
    <>
      <AdminPageHeader title="New plan" back={{ href: "/admin/plans", label: "All plans" }} />
      <PlanForm />
    </>
  );
}
