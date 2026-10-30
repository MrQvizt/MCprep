import "server-only";
import { db } from "@/lib/db";
import type { OrderStatus } from "@/generated/prisma/client";
import { addDaysToDateString } from "@/lib/time";

const CONFIRMED: OrderStatus[] = ["CONFIRMED", "IN_PREPARATION"];
const PENDING: OrderStatus[] = ["NEW", "CONTACTED"];
const LONGEST_PLAN_DAYS = 56;

export interface KitchenDish {
  name: string;
  /** Meals per week from confirmed orders. */
  confirmed: number;
  /** Meals per week from orders not confirmed yet. */
  pending: number;
}

export interface KitchenWeek {
  weekStart: string;
  dishes: KitchenDish[];
  confirmedOrders: number;
  pendingOrders: number;
  confirmedMeals: number;
  pendingMeals: number;
  /** Going-ahead orders with dishes but no start date yet (not counted above). */
  undated: number;
}

const utcDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

/**
 * What the kitchen cooks in the week starting `weekStart` (YYYY-MM-DD): the
 * weekly dish choices of every order whose dates overlap that week.
 */
export async function getKitchenWeek(weekStart: string): Promise<KitchenWeek> {
  const from = utcDate(weekStart);
  const to = utcDate(addDaysToDateString(weekStart, 7));
  const earliest = utcDate(addDaysToDateString(weekStart, -LONGEST_PLAN_DAYS));
  const [orders, undated] = await Promise.all([
    db.order.findMany({
      where: {
        status: { in: [...CONFIRMED, ...PENDING] },
        preferredStartDate: { gte: earliest, lt: to },
        mealSelections: { some: {} },
      },
      select: {
        status: true,
        preferredStartDate: true,
        planDurationDays: true,
        mealSelections: { select: { mealName: true, quantity: true } },
      },
    }),
    db.order.count({ where: { status: { in: CONFIRMED }, preferredStartDate: null, mealSelections: { some: {} } } }),
  ]);

  const dishes = new Map<string, KitchenDish>();
  let confirmedOrders = 0;
  let pendingOrders = 0;
  for (const o of orders) {
    const start = o.preferredStartDate!;
    const end = new Date(start.getTime() + o.planDurationDays * 86_400_000);
    if (!(start < to && end > from)) continue; // doesn't overlap this week
    const confirmed = CONFIRMED.includes(o.status);
    if (confirmed) confirmedOrders++;
    else pendingOrders++;
    for (const m of o.mealSelections) {
      const d = dishes.get(m.mealName) ?? { name: m.mealName, confirmed: 0, pending: 0 };
      if (confirmed) d.confirmed += m.quantity;
      else d.pending += m.quantity;
      dishes.set(m.mealName, d);
    }
  }
  const list = [...dishes.values()].sort((a, b) => b.confirmed + b.pending - (a.confirmed + a.pending) || a.name.localeCompare(b.name));
  return {
    weekStart,
    dishes: list,
    confirmedOrders,
    pendingOrders,
    confirmedMeals: list.reduce((n, d) => n + d.confirmed, 0),
    pendingMeals: list.reduce((n, d) => n + d.pending, 0),
    undated,
  };
}
