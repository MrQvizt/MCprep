import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import {
  SETTINGS_GROUPS,
  SETTINGS_SCHEMAS,
  parseSettings,
  type AllSettings,
  type SettingsGroup,
  type SettingsOf,
} from "./schema";

export * from "./schema";

/**
 * Load every settings group (one query, memoised per request). Calling this
 * marks the route as dynamic so edits in the admin appear immediately.
 */
export const getSettings = cache(async (): Promise<AllSettings> => {
  await connection();
  let rows: { key: string; value: unknown }[] = [];
  try {
    rows = await db.siteSetting.findMany({ where: { key: { in: SETTINGS_GROUPS } } });
  } catch (error) {
    console.error("[settings] failed to load settings, using defaults", error);
  }
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<SettingsGroup, unknown>;
  for (const group of SETTINGS_GROUPS) out[group] = parseSettings(group, byKey.get(group));
  return out as AllSettings;
});

export async function getSettingsGroup<G extends SettingsGroup>(group: G): Promise<SettingsOf<G>> {
  const all = await getSettings();
  return all[group];
}

/**
 * Merge a partial update into a settings group and persist it.
 * Callers (admin actions) must validate user input with their own strict form
 * schema first — the group schemas here are lenient (fall back to defaults)
 * so that the public site never breaks on a malformed stored value.
 */
export async function updateSettingsGroup<G extends SettingsGroup>(
  group: G,
  patch: Partial<SettingsOf<G>>,
  updatedById?: string | null,
): Promise<SettingsOf<G>> {
  const existing = await db.siteSetting.findUnique({ where: { key: group } });
  const current = parseSettings(group, existing?.value);
  const merged = { ...current, ...patch };
  const value = SETTINGS_SCHEMAS[group].parse(merged) as SettingsOf<G>;
  await db.siteSetting.upsert({
    where: { key: group },
    create: { key: group, value: value as object, updatedById: updatedById ?? null },
    update: { value: value as object, updatedById: updatedById ?? null },
  });
  return value;
}
