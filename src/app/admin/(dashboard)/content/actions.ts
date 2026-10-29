"use server";

import { revalidatePath } from "next/cache";
import { fail, fdString, handleActionError, ok, type ActionState } from "@/lib/actions";
import { CONTENT_FIELDS, CONTENT_VIEW_PATHS, htmlFieldNames, isContentKey, mediaFieldNames, validateContentBlock } from "@/lib/admin/content-fields";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { CONTENT_LABELS, getContent, saveContent } from "@/lib/content";
import { db } from "@/lib/db";
import { revalidatePublicSite } from "@/lib/revalidate";
import { sanitizeRichText } from "@/lib/sanitize";
import { formatDate } from "@/lib/time";

function refresh(key: string) {
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${key}`);
  revalidatePublicSite();
}

export async function saveContentBlock(key: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.content);
    if (!isContentKey(key)) return fail("Unknown content block.");
    let raw: unknown;
    try {
      raw = JSON.parse(fdString(fd, "data") || "{}");
    } catch {
      return fail("The form data couldn't be read. Please reload the page and try again.");
    }
    const result = validateContentBlock(key, raw);
    if (!result.ok) return fail("Please check the highlighted fields.", result.errors);
    const value = result.value;

    const current = (await getContent(key)) as Record<string, unknown>;
    for (const name of htmlFieldNames(key)) {
      value[name] = sanitizeRichText(String(value[name] ?? ""));
      // Legal pages: keep "last updated" accurate automatically.
      if ("lastUpdated" in value && value[name] !== current[name] && value.lastUpdated === current.lastUpdated) {
        value.lastUpdated = formatDate(new Date());
      }
    }
    const mediaIds = mediaFieldNames(key)
      .map((n) => value[n])
      .filter((v): v is string => typeof v === "string");
    if (mediaIds.length > 0) {
      const found = new Set((await db.mediaAsset.findMany({ where: { id: { in: mediaIds } }, select: { id: true } })).map((m) => m.id));
      for (const n of mediaFieldNames(key)) {
        if (typeof value[n] === "string" && !found.has(value[n] as string)) value[n] = null;
      }
    }

    await saveContent(key, value, admin.id);
    const changed = CONTENT_FIELDS[key].filter((f) => JSON.stringify(current[f.name]) !== JSON.stringify(value[f.name])).map((f) => f.label);
    await logAudit({
      actor: admin,
      action: "content.update",
      entityType: "PageContent",
      entityId: key,
      summary: `Updated ${CONTENT_LABELS[key]}${changed.length ? ` (${changed.slice(0, 5).join(", ")}${changed.length > 5 ? "…" : ""})` : ""}`,
    });
    refresh(key);
    return ok(`Saved. Changes are live on ${CONTENT_VIEW_PATHS[key]}`);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function resetContentBlock(key: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.content);
    if (!isContentKey(key)) return fail("Unknown content block.");
    await db.pageContent.deleteMany({ where: { key } });
    await logAudit({ actor: admin, action: "content.reset", entityType: "PageContent", entityId: key, summary: `Reset ${CONTENT_LABELS[key]} to the default text` });
    refresh(key);
    return ok("Restored the default text");
  } catch (error) {
    return handleActionError(error);
  }
}
