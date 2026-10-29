import "server-only";
import { db } from "@/lib/db";

interface SortDelegate {
  findMany(args: { where?: object; orderBy: object[]; select: { id: true } }): Promise<{ id: string }[]>;
  update(args: { where: { id: string }; data: { sortOrder: number } }): unknown;
}

const DELEGATES = {
  faq: db.fAQ,
  meal: db.meal,
  plan: db.plan,
  galleryItem: db.galleryItem,
  testimonial: db.testimonial,
  deliveryArea: db.deliveryArea,
  collectionPoint: db.collectionPoint,
  businessListing: db.businessListing,
  blogCategory: db.blogCategory,
} as const;

export type SortableModel = keyof typeof DELEGATES;

/**
 * Move an item one position up or down and renumber the list (0, 1, 2 …).
 * Lists are small (tens of items), so renumbering everything is simplest.
 */
export async function moveItem(model: SortableModel, id: string, direction: "up" | "down", where: object = {}) {
  const delegate = DELEGATES[model] as unknown as SortDelegate;
  const rows = await delegate.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const ids = rows.map((r) => r.id);
  const index = ids.indexOf(id);
  if (index === -1) return false;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return false;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await db.$transaction(
    ids.map((itemId, i) => delegate.update({ where: { id: itemId }, data: { sortOrder: i } })) as never,
  );
  return true;
}

/** Next sortOrder value for appending a new item at the end. */
export async function nextSortOrder(model: SortableModel): Promise<number> {
  const delegate = DELEGATES[model] as unknown as {
    aggregate(args: { _max: { sortOrder: true } }): Promise<{ _max: { sortOrder: number | null } }>;
  };
  const agg = await delegate.aggregate({ _max: { sortOrder: true } });
  return (agg._max.sortOrder ?? -1) + 1;
}
