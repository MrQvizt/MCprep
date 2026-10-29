/** Pure helpers for delivery-area pages. */

export type RegionValue = "MALTA" | "GOZO" | "COMINO";

export const REGION_LABELS: Record<RegionValue, string> = { MALTA: "Malta", GOZO: "Gozo", COMINO: "Comino" };
const REGION_ORDER: RegionValue[] = ["MALTA", "GOZO", "COMINO"];

export function groupByRegion<T extends { region: RegionValue }>(areas: T[]): { region: RegionValue; label: string; areas: T[] }[] {
  return REGION_ORDER.map((region) => ({ region, label: REGION_LABELS[region], areas: areas.filter((a) => a.region === region) })).filter(
    (g) => g.areas.length > 0,
  );
}

/** Minimum unique copy before a locality gets its own indexable page (avoids thin doorway pages). */
export const LOCALITY_PAGE_MIN_CHARS = 120;

export function hasLocalityPage(area: {
  isPublished: boolean;
  hasPublicPage: boolean;
  pageIntro: string | null;
  pageBody: string | null;
}): boolean {
  if (!area.isPublished || !area.hasPublicPage) return false;
  const copy = `${area.pageIntro ?? ""} ${area.pageBody ?? ""}`.trim();
  return copy.length >= LOCALITY_PAGE_MIN_CHARS;
}
