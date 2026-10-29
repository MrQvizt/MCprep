import Link from "next/link";
import { ArchiveRestore, ArrowDown, ArrowUp, Award, Eye, EyeOff, Pencil, Plus, Tags } from "lucide-react";
import { ActionButton } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DemoBadge, StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { archivePlan, movePlan, recommendPlan, togglePlan } from "./actions";

export const metadata = { title: "Plans & prices" };

export default async function PlansPage() {
  await requireAdmin(AREA_ROLES.plans);
  const plans = await db.plan.findMany({
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }],
    include: { _count: { select: { orders: true } } },
  });
  const current = plans.filter((p) => !p.archivedAt);
  const archived = plans.filter((p) => p.archivedAt);

  return (
    <>
      <AdminPageHeader
        title="Plans & prices"
        description="The packages customers choose from. Prices are never hard-coded — change them here and the website, order form and emails update immediately. Existing orders keep the price they were quoted."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/plans/new">
              <Plus className="size-4" /> New plan
            </Link>
          </Button>
        }
      />
      {current.length === 0 ? (
        <EmptyState icon={Tags} title="No plans yet" description="Create your packages: lunch or lunch + dinner, 5 or 7 days, weekly or monthly." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {current.map((plan, i) => (
            <li key={plan.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/plans/${plan.id}`} className="font-medium hover:underline">
                    {plan.name}
                  </Link>
                  {plan.tagline && <span className="text-sm text-muted-foreground">· {plan.tagline}</span>}
                  {plan.isDemo && <DemoBadge />}
                </div>
                <p className="mt-0.5 text-sm tabular">
                  {plan.priceCents === null ? (
                    <span className="text-amber-700">No price set — shown as “price confirmed with you”</span>
                  ) : (
                    <strong>{formatMoney(plan.priceCents)}</strong>
                  )}
                  <span className="text-muted-foreground">
                    {" "}
                    · {plan.durationDays} days{plan.mealsIncluded ? ` · ${plan.mealsIncluded} meals` : ""} · {plan._count.orders} order(s)
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge tone={plan.isActive ? "good" : "neutral"}>{plan.isActive ? "Available" : "Hidden"}</StatusBadge>
                  {plan.isRecommended && <StatusBadge tone="dark">Recommended</StatusBadge>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ActionButton action={movePlan.bind(null, plan.id, "up")} label="Move up" disabled={i === 0}>
                  <ArrowUp className="size-4" />
                </ActionButton>
                <ActionButton action={movePlan.bind(null, plan.id, "down")} label="Move down" disabled={i === current.length - 1}>
                  <ArrowDown className="size-4" />
                </ActionButton>
                {!plan.isRecommended && (
                  <ActionButton action={recommendPlan.bind(null, plan.id)} label="Make recommended">
                    <Award className="size-4" />
                  </ActionButton>
                )}
                <ActionButton action={togglePlan.bind(null, plan.id)} label={plan.isActive ? "Hide plan" : "Make available"}>
                  {plan.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </ActionButton>
                <Button asChild variant="ghost" size="icon-sm" aria-label="Edit">
                  <Link href={`/admin/plans/${plan.id}`}>
                    <Pencil className="size-4" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Archived plans</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {archived.map((plan) => (
              <li key={plan.id} className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <Link href={`/admin/plans/${plan.id}`} className="font-medium hover:underline">
                    {plan.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{plan._count.orders} order(s) keep their original price and details.</p>
                </div>
                <ActionButton action={archivePlan.bind(null, plan.id, false)} label="Restore" variant="outline" size="sm">
                  <ArchiveRestore className="size-4" /> Restore
                </ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
