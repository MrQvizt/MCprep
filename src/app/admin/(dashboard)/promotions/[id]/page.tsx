import Link from "next/link";
import { notFound } from "next/navigation";
import { Inbox, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { DemoBadge, StatusBadge } from "@/components/admin/status-badge";
import { PromoBanner } from "@/components/public/promo-banner";
import { Button } from "@/components/ui/button";
import { redemptionStats } from "@/lib/admin/promotions";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { MEDIA_SELECT } from "@/lib/media";
import { promotionState } from "@/lib/pricing";
import { AUDIENCE_LABELS, PROMOTION_STATE_LABELS, THEME_LABELS, redemptionCounts, toPublicPromotion } from "@/lib/promotions";
import { getSettingsGroup } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { removePromotion } from "../actions";
import { DuplicatePromotion } from "../duplicate-form";
import { PromotionForm } from "../promotion-form";

export const metadata = { title: "Edit campaign" };

export default async function EditPromotionPage({ params, searchParams }: PageProps<"/admin/promotions/[id]">) {
  await requireAdmin(AREA_ROLES.promotions);
  const { id } = await params;
  const sp = await searchParams;
  const [promotion, business] = await Promise.all([
    db.promotion.findUnique({
      where: { id },
      include: {
        eligiblePlans: { select: { planId: true } },
        image: { select: MEDIA_SELECT },
        selectedCustomers: { include: { customer: { select: { email: true } } } },
      },
    }),
    getSettingsGroup("business"),
  ]);
  if (!promotion) notFound();
  const [plans, counts, stats] = await Promise.all([
    db.plan.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true } }),
    redemptionCounts([id]),
    redemptionStats([id]),
  ]);
  const now = new Date();
  const counted = counts.get(id) ?? 0;
  const state = promotionState({ ...promotion, redemptionCount: counted }, now);
  const view = toPublicPromotion({ ...promotion, image: promotion.image }, counted, now, business.currency);
  const s = stats.get(id)!;

  return (
    <>
      <AdminPageHeader
        title={promotion.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge tone={state === "ACTIVE" ? "good" : state === "SCHEDULED" ? "info" : "neutral"}>{PROMOTION_STATE_LABELS[state]}</StatusBadge>
            {promotion.isDemo && <DemoBadge />}
            <span>
              {formatDateTime(promotion.startsAt, business.timeZone)} → {formatDateTime(promotion.endsAt, business.timeZone)} (Malta time)
            </span>
          </span>
        }
        back={{ href: "/admin/promotions", label: "All campaigns" }}
        actions={
          <>
            <DuplicatePromotion id={promotion.id} name={promotion.name} themes={THEME_LABELS} />
            {s.orders > 0 ? (
              <Button asChild variant="outline">
                <Link href={`/admin/orders?promotion=${promotion.id}`}>
                  <Inbox className="size-4" /> {s.orders} order(s)
                </Link>
              </Button>
            ) : (
              <ConfirmAction
                action={removePromotion.bind(null, promotion.id)}
                title={`Delete “${promotion.name}”?`}
                description="No orders are linked to this campaign, so it can be deleted permanently."
                confirmLabel="Delete"
                destructive
                variant="outline"
              >
                <Trash2 className="size-4" /> Delete
              </ConfirmAction>
            )}
          </>
        }
      />

      {sp.duplicated && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This is a copy. It&apos;s disabled and has placeholder dates — set the real start and end times, check the discount and wording, then
          enable it.
        </p>
      )}

      <AdminCard
        title="Preview"
        description="How the banner looks on the website with the saved settings. Save to refresh the preview."
        className="mb-6 overflow-hidden"
      >
        {/* Rendered at 80% so the desktop layout fits the narrower admin column. */}
        <div className="dark -mx-5 -mb-5 sm:-mx-6 sm:-mb-6" style={{ zoom: 0.8 }}>
          <PromoBanner promo={view} serverNow={now.toISOString()} preview headingLevel="h2" />
        </div>
      </AdminCard>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Order requests", s.orders],
          ["Pending verification", s.requested],
          ["Approved", s.approved],
          ["Rejected", s.rejected],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular">{value}</p>
          </div>
        ))}
      </div>

      <PromotionForm
        plans={plans}
        themes={THEME_LABELS}
        audiences={AUDIENCE_LABELS}
        timeZone={business.timeZone}
        promotion={{
          ...promotion,
          image: promotion.image,
          planIds: promotion.eligiblePlans.map((p) => p.planId),
          startsAt: promotion.startsAt.toISOString(),
          endsAt: promotion.endsAt.toISOString(),
          selectedEmails: promotion.selectedCustomers.map((c) => c.customer.email).filter((e): e is string => Boolean(e)),
        }}
      />
    </>
  );
}
