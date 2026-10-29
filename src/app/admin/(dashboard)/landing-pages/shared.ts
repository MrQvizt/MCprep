import "server-only";
import { db } from "@/lib/db";
import { promotionState } from "@/lib/pricing";
import { PROMOTION_STATE_LABELS, redemptionCounts } from "@/lib/promotions";

export async function landingFormOptions() {
  const [promotions, plans] = await Promise.all([
    db.promotion.findMany({ orderBy: { endsAt: "desc" } }),
    db.plan.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const counts = await redemptionCounts(promotions.map((p) => p.id));
  const now = new Date();
  return {
    plans,
    promotions: promotions.map((p) => ({
      id: p.id,
      name: p.name,
      state: PROMOTION_STATE_LABELS[promotionState({ ...p, redemptionCount: counts.get(p.id) ?? 0 }, now)],
    })),
  };
}
