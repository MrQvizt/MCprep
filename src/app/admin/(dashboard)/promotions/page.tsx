import Link from "next/link";
import { Plus, Power, PowerOff, Timer } from "lucide-react";
import { ActionButton } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DemoBadge, StatusBadge, type Tone } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { redemptionStats } from "@/lib/admin/promotions";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { discountLabel, promotionState, type PromotionState } from "@/lib/pricing";
import { AUDIENCE_LABELS, PROMOTION_STATE_LABELS, THEME_LABELS, redemptionCounts } from "@/lib/promotions";
import { getSettingsGroup } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { togglePromotion } from "./actions";

export const metadata = { title: "Promotions" };

const STATE_TONES: Record<PromotionState, Tone> = {
  ACTIVE: "good",
  SCHEDULED: "info",
  DRAFT: "neutral",
  EXPIRED: "neutral",
  LIMIT_REACHED: "warn",
};

export default async function PromotionsPage() {
  await requireAdmin(AREA_ROLES.promotions);
  const { timeZone } = await getSettingsGroup("business");
  const promotions = await db.promotion.findMany({ orderBy: [{ isEnabled: "desc" }, { endsAt: "desc" }] });
  const ids = promotions.map((p) => p.id);
  const [stats, counted] = await Promise.all([redemptionStats(ids), redemptionCounts(ids)]);
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="Promotions"
        description="Genuine, time-limited offers with a real countdown. Create seasonal campaigns (Halloween, Black Friday, Christmas…) and reuse them each year."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/promotions/new">
              <Plus className="size-4" /> New campaign
            </Link>
          </Button>
        }
      />
      {promotions.length === 0 ? (
        <EmptyState icon={Timer} title="No campaigns yet" description="Create your first offer — for example a first-order discount for new customers." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Schedule (Malta time)</th>
                <th className="px-4 py-3 font-medium">Requests</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {promotions.map((p) => {
                const state = promotionState({ ...p, redemptionCount: counted.get(p.id) ?? 0 }, now);
                const s = stats.get(p.id)!;
                return (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/admin/promotions/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {p.theme !== "NONE" && <StatusBadge>{THEME_LABELS[p.theme]}</StatusBadge>}
                        <StatusBadge tone={p.audience === "NEW_CUSTOMERS" ? "info" : "neutral"}>{AUDIENCE_LABELS[p.audience]}</StatusBadge>
                        {p.code && <StatusBadge>Code {p.code}</StatusBadge>}
                        {p.isDemo && <DemoBadge />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={STATE_TONES[state]}>{PROMOTION_STATE_LABELS[state]}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{discountLabel(p)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(p.startsAt, timeZone)}
                      <br />→ {formatDateTime(p.endsAt, timeZone)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {s.orders > 0 ? (
                        <Link href={`/admin/orders?promotion=${p.id}`} className="font-medium underline-offset-4 hover:underline">
                          {s.orders} order(s)
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">No orders yet</span>
                      )}
                      {s.requested + s.approved + s.rejected > 0 && (
                        <p className="mt-1 text-muted-foreground">
                          {s.requested} pending · {s.approved} approved · {s.rejected} rejected
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActionButton
                        action={togglePromotion.bind(null, p.id, !p.isEnabled)}
                        label={p.isEnabled ? "Disable" : "Enable"}
                        variant="outline"
                        size="sm"
                      >
                        {p.isEnabled ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                        {p.isEnabled ? "Disable" : "Enable"}
                      </ActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
