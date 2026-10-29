import { notFound } from "next/navigation";
import { Archive, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { DemoBadge } from "@/components/admin/status-badge";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { archivePlan, removePlan } from "../actions";
import { PlanForm } from "../plan-form";

export const metadata = { title: "Edit plan" };

export default async function EditPlanPage({ params }: PageProps<"/admin/plans/[id]">) {
  await requireAdmin(AREA_ROLES.plans);
  const { id } = await params;
  const plan = await db.plan.findUnique({ where: { id }, include: { _count: { select: { orders: true } } } });
  if (!plan) notFound();
  const priceHistory = await db.auditLog.findMany({
    where: { entityType: "Plan", entityId: id, action: "plan.price_change" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const orders = plan._count.orders;

  return (
    <>
      <AdminPageHeader
        title={plan.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {plan.isDemo && <DemoBadge />}
            {plan.archivedAt ? "Archived." : plan.isActive ? "Available to order." : "Hidden from customers."}
          </span>
        }
        back={{ href: "/admin/plans", label: "All plans" }}
        actions={
          plan.archivedAt ? null : orders > 0 ? (
            <ConfirmAction
              action={archivePlan.bind(null, plan.id, true)}
              title={`Archive “${plan.name}”?`}
              description={`${orders} order(s) use this plan, so it can't be deleted. Archiving hides it from customers; existing orders keep their details and price.`}
              confirmLabel="Archive"
              variant="outline"
            >
              <Archive className="size-4" /> Archive
            </ConfirmAction>
          ) : (
            <ConfirmAction
              action={removePlan.bind(null, plan.id)}
              title={`Delete “${plan.name}”?`}
              description="No orders use this plan, so it can be deleted permanently."
              confirmLabel="Delete"
              destructive
              variant="outline"
            >
              <Trash2 className="size-4" /> Delete
            </ConfirmAction>
          )
        }
      />
      <PlanForm plan={plan} orderCount={orders} />
      {priceHistory.length > 0 && (
        <AdminCard title="Price history" className="mt-6">
          <ul className="space-y-1.5 text-sm">
            {priceHistory.map((h) => (
              <li key={h.id}>
                <span className="text-muted-foreground">{formatDateTime(h.createdAt)} · {h.actorEmail ?? "system"} — </span>
                {h.summary}
              </li>
            ))}
          </ul>
        </AdminCard>
      )}
    </>
  );
}
