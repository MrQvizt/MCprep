"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fdBool, fdString, fail, handleActionError, ok, type ActionState } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { checkRedirect, clearRedirectCache, REDIRECT_PROBLEM_MESSAGES } from "@/lib/redirects";
import { getActiveRedirectSources, getKnownPublicPaths } from "@/lib/seo/sitemap";
import { normalizePath } from "@/lib/urls";

const schema = z.object({
  fromPath: z.string().trim().min(1, "Enter the old address, for example /old-page.").max(500),
  toPath: z.string().trim().min(1, "Enter where visitors should go.").max(1000),
  statusCode: z.union([z.literal(301), z.literal(302)]),
  note: z.string().trim().max(300).transform((v) => v || null),
  isActive: z.boolean(),
});

function cleanTarget(to: string): string {
  if (/^https?:\/\//i.test(to)) return to;
  const [path, query = ""] = to.split("?");
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return query ? `${p}?${query}` : p;
}

function refresh() {
  clearRedirectCache();
  revalidatePath("/admin/redirects");
  revalidatePath("/admin/seo");
}

export async function saveRedirect(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const admin = await assertAdmin(AREA_ROLES.redirects);
    const raw = schema.parse({
      fromPath: fdString(fd, "fromPath"),
      toPath: fdString(fd, "toPath"),
      statusCode: Number(fdString(fd, "statusCode") || 301),
      note: fdString(fd, "note"),
      isActive: fdBool(fd, "isActive"),
    });
    const rawFrom = raw.fromPath.startsWith("http") ? raw.fromPath : raw.fromPath.startsWith("/") ? raw.fromPath : `/${raw.fromPath}`;
    const fromPath = normalizePath(rawFrom);
    const toPath = cleanTarget(raw.toPath.startsWith("/") || /^https?:\/\//i.test(raw.toPath) ? raw.toPath : `/${raw.toPath}`);

    const existing = await db.redirectRule.findMany({ select: { id: true, fromPath: true, toPath: true, isActive: true } });
    const others = existing.filter((r) => r.id !== id);
    if (others.some((r) => normalizePath(r.fromPath) === fromPath)) {
      return fail("There's already a redirect from this address.", { fromPath: "There's already a redirect from this address — edit that one instead." });
    }
    const problem = raw.isActive ? checkRedirect({ fromPath, toPath }, others) : checkRedirect({ fromPath, toPath }, []);
    if (problem) {
      const field = problem === "RESERVED_SOURCE" || problem === "INVALID_SOURCE" || problem === "SAME_PATH" ? "fromPath" : "toPath";
      return fail(REDIRECT_PROBLEM_MESSAGES[problem], { [field]: REDIRECT_PROBLEM_MESSAGES[problem] });
    }

    const [known, redirectSources] = await Promise.all([getKnownPublicPaths(), getActiveRedirectSources()]);
    if (known.has(fromPath) && !fdBool(fd, "confirmReplacePage")) {
      return fail("This address is a live page on your website.", {
        confirmReplacePage: "Visitors will no longer be able to open this page. Tick the box to confirm.",
      });
    }
    if (!/^https?:\/\//i.test(toPath)) {
      const target = normalizePath(toPath);
      if (!known.has(target) && !redirectSources.has(target) && !fdBool(fd, "confirmUnknownTarget")) {
        return fail("The new address doesn't seem to exist on your website.", {
          confirmUnknownTarget: "We couldn't find this page. Tick the box if you're sure the address is correct.",
        });
      }
    }

    const data = { fromPath, toPath, statusCode: raw.statusCode, note: raw.note, isActive: raw.isActive };
    if (id) {
      await db.redirectRule.update({ where: { id }, data });
      await logAudit({ actor: admin, action: "redirect.update", entityType: "RedirectRule", entityId: id, summary: `Redirect ${fromPath} → ${toPath} (${raw.statusCode})` });
    } else {
      const rule = await db.redirectRule.create({ data });
      createdId = rule.id;
      await logAudit({ actor: admin, action: "redirect.create", entityType: "RedirectRule", entityId: rule.id, summary: `Redirect ${fromPath} → ${toPath} (${raw.statusCode})` });
    }
    refresh();
  } catch (error) {
    return handleActionError(error);
  }
  if (createdId) redirect("/admin/redirects?created=1");
  return ok("Redirect saved");
}

export async function deleteRedirect(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.redirects);
    const rule = await db.redirectRule.delete({ where: { id } });
    await logAudit({ actor: admin, action: "redirect.delete", entityType: "RedirectRule", entityId: id, summary: `Deleted redirect ${rule.fromPath} → ${rule.toPath}` });
    refresh();
    return ok("Redirect deleted");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function toggleRedirect(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.redirects);
    const rule = await db.redirectRule.findUniqueOrThrow({ where: { id } });
    if (!rule.isActive) {
      const others = await db.redirectRule.findMany({ where: { id: { not: id } }, select: { fromPath: true, toPath: true, isActive: true } });
      const problem = checkRedirect({ fromPath: rule.fromPath, toPath: rule.toPath }, others);
      if (problem === "LOOP") return fail(REDIRECT_PROBLEM_MESSAGES.LOOP);
    }
    await db.redirectRule.update({ where: { id }, data: { isActive: !rule.isActive } });
    await logAudit({
      actor: admin,
      action: rule.isActive ? "redirect.disable" : "redirect.enable",
      entityType: "RedirectRule",
      entityId: id,
      summary: `${rule.isActive ? "Paused" : "Activated"} redirect ${rule.fromPath}`,
    });
    refresh();
    return ok(rule.isActive ? "Redirect paused" : "Redirect active");
  } catch (error) {
    return handleActionError(error);
  }
}
