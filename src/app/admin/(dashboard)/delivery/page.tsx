import Link from "next/link";
import { ArrowDown, ArrowUp, MapPin, Pause, Pencil, Play, Plus, Trash2, Truck } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatWeekdays } from "@/lib/time";
import { deleteCollectionPoint, moveCollectionPoint, toggleCollectionPointActive } from "./actions";
import { AreasList } from "./areas-list";
import { FulfillmentForm } from "./fulfillment-form";

export const metadata = { title: "Delivery & collection" };

export default async function DeliveryPage() {
  await requireAdmin(AREA_ROLES.delivery);
  const [settings, areas, points] = await Promise.all([
    getSettings(),
    db.deliveryArea.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.collectionPoint.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const live = areas.filter((a) => a.deliveryAvailable && a.isPublished).length;

  return (
    <>
      <AdminPageHeader
        title="Delivery & collection"
        description="Choose how customers get their meals, which Malta localities you deliver to, and where they can collect. Everything here feeds the order form and the Delivery Areas page."
      />

      <div className="space-y-8">
        <AdminCard title="How customers get their meals" description="Switch collection and delivery on or off and add the details customers see.">
          <FulfillmentForm values={settings.fulfillment} />
        </AdminCard>

        <section aria-labelledby="areas-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="areas-title" className="text-lg font-semibold">
                Delivery localities
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Only switch on localities you actually deliver to — customers can only choose switched-on localities. The example
                localities added at setup are <strong>not confirmed</strong>. {live} of {areas.length} currently available to customers.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/admin/delivery/areas/new">
                <Plus className="size-4" /> Add locality
              </Link>
            </Button>
          </div>
          {areas.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No delivery localities yet"
              description="Add the localities you deliver to, with delivery days and any fees."
              action={
                <Button asChild>
                  <Link href="/admin/delivery/areas/new">Add a locality</Link>
                </Button>
              }
            />
          ) : (
            <AreasList
              areas={areas.map((a) => ({
                id: a.id,
                name: a.name,
                slug: a.slug,
                region: a.region,
                deliveryAvailable: a.deliveryAvailable,
                isPublished: a.isPublished,
                deliveryFeeCents: a.deliveryFeeCents,
                minOrderCents: a.minOrderCents,
                deliveryDays: a.deliveryDays,
                hasPublicPage: a.hasPublicPage,
              }))}
            />
          )}
        </section>

        <section id="collection" aria-labelledby="collection-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="collection-title" className="text-lg font-semibold">
                Collection points
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Where customers can pick up their meals. Addresses stay private unless you choose to show them.
              </p>
            </div>
            <Button asChild size="lg" variant="outline">
              <Link href="/admin/delivery/collection/new">
                <Plus className="size-4" /> Add collection point
              </Link>
            </Button>
          </div>
          {points.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No collection points yet"
              description="Until you add one, customers choosing collection are told the details will be confirmed with them."
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {points.map((p, i) => (
                <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/delivery/collection/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    {p.address && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{p.address}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge tone={p.isActive ? "good" : "neutral"}>{p.isActive ? "Active" : "Paused"}</StatusBadge>
                      <StatusBadge tone={p.showAddressPublicly ? "info" : "neutral"}>
                        {p.showAddressPublicly ? "Address public" : "Address private"}
                      </StatusBadge>
                      {p.availableDays.length > 0 && <StatusBadge>{formatWeekdays(p.availableDays)}</StatusBadge>}
                      {p.timeWindows && <StatusBadge>{p.timeWindows}</StatusBadge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <ActionButton action={moveCollectionPoint.bind(null, p.id, "up")} label="Move up" disabled={i === 0}>
                      <ArrowUp className="size-4" />
                    </ActionButton>
                    <ActionButton action={moveCollectionPoint.bind(null, p.id, "down")} label="Move down" disabled={i === points.length - 1}>
                      <ArrowDown className="size-4" />
                    </ActionButton>
                    <ActionButton action={toggleCollectionPointActive.bind(null, p.id)} label={p.isActive ? "Pause" : "Activate"}>
                      {p.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </ActionButton>
                    <Button asChild variant="ghost" size="icon-sm" aria-label={`Edit ${p.name}`}>
                      <Link href={`/admin/delivery/collection/${p.id}`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                    <ConfirmAction
                      action={deleteCollectionPoint.bind(null, p.id)}
                      title={`Delete ${p.name}?`}
                      description="Customers will no longer see it. Past orders keep its name."
                      confirmLabel="Delete"
                      destructive
                      variant="ghost"
                      size="icon-sm"
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Delete {p.name}</span>
                    </ConfirmAction>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
