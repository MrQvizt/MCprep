import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { AUDIENCE_LABELS, THEME_LABELS } from "@/lib/promotions";
import { getSettingsGroup } from "@/lib/settings";
import { PromotionForm } from "../promotion-form";

export const metadata = { title: "New campaign" };

export default async function NewPromotionPage() {
  await requireAdmin(AREA_ROLES.promotions);
  const [{ timeZone }, plans] = await Promise.all([
    getSettingsGroup("business"),
    db.plan.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true } }),
  ]);
  return (
    <>
      <AdminPageHeader
        title="New campaign"
        description="Set the discount, who it's for and when it runs. It only goes live when enabled, between its start and end times."
        back={{ href: "/admin/promotions", label: "All campaigns" }}
      />
      <PromotionForm plans={plans} themes={THEME_LABELS} audiences={AUDIENCE_LABELS} timeZone={timeZone} />
    </>
  );
}
