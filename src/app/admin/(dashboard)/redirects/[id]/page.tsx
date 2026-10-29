import { notFound } from "next/navigation";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { RedirectForm } from "../redirect-form";

export const metadata = { title: "Edit redirect" };

export default async function EditRedirectPage({ params }: PageProps<"/admin/redirects/[id]">) {
  await requireAdmin(AREA_ROLES.redirects);
  const { id } = await params;
  const rule = await db.redirectRule.findUnique({ where: { id } });
  if (!rule) notFound();
  return (
    <>
      <AdminPageHeader
        title="Edit redirect"
        back={{ href: "/admin/redirects", label: "All redirects" }}
        description={`Used ${rule.hits} time${rule.hits === 1 ? "" : "s"}${rule.lastHitAt ? `, last on ${formatDateTime(rule.lastHitAt)}` : ""}.`}
      />
      <AdminCard>
        <RedirectForm rule={rule} />
      </AdminCard>
    </>
  );
}
