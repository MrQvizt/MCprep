import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { CONTENT_KEYS, CONTENT_SCHEMAS, parseContent, type ContentKey, type ContentOf } from "./schema";

export * from "./schema";

const loadAllContent = cache(async (): Promise<Map<string, unknown>> => {
  await connection();
  try {
    const rows = await db.pageContent.findMany({ where: { key: { in: CONTENT_KEYS } } });
    return new Map(rows.map((r) => [r.key, r.data]));
  } catch (error) {
    console.error("[content] failed to load page content, using defaults", error);
    return new Map();
  }
});

/** Read a content block (falls back to the default copy). Memoised per request. */
export async function getContent<K extends ContentKey>(key: K): Promise<ContentOf<K>> {
  const all = await loadAllContent();
  return parseContent(key, all.get(key));
}

export async function getContents<const K extends readonly ContentKey[]>(
  keys: K,
): Promise<{ [I in keyof K]: ContentOf<K[I]> }> {
  const all = await loadAllContent();
  return keys.map((k) => parseContent(k, all.get(k))) as { [I in keyof K]: ContentOf<K[I]> };
}

/** Validate and store a content block. Throws ZodError on invalid input. */
export async function saveContent<K extends ContentKey>(key: K, data: unknown, updatedById?: string | null) {
  const value = CONTENT_SCHEMAS[key].parse(data) as ContentOf<K>;
  await db.pageContent.upsert({
    where: { key },
    create: { key, data: value as object, updatedById: updatedById ?? null },
    update: { data: value as object, updatedById: updatedById ?? null },
  });
  return value;
}
