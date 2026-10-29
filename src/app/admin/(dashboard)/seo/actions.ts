"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fdBool, fdOptional, fail, handleActionError, ok, type ActionState } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { revalidatePublicSite } from "@/lib/revalidate";
import { STATIC_PAGES } from "@/lib/seo/pages";
import { isSafeHttpUrl, isSafeInternalPath } from "@/lib/urls";

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .nullable()
    .transform((v) => (v ? v : null));

const seoSchema = z.object({
  title: optional(120, "The Google title"),
  description: optional(320, "The description"),
  primaryTopic: optional(120, "The search topic"),
  ogTitle: optional(120, "The social title"),
  ogDescription: optional(320, "The social description"),
  ogImageId: z.string().trim().nullable(),
  noindex: z.boolean(),
  canonicalUrl: optional(500, "The canonical URL").refine(
    (v) => v === null || isSafeInternalPath(v) || (isSafeHttpUrl(v) && v.startsWith("https://")),
    "Use a path starting with / (for example /meal-prep-malta) or a full https:// address.",
  ),
  breadcrumbLabel: optional(60, "The breadcrumb label"),
});

function getPage(pageKey: string) {
  return STATIC_PAGES.find((p) => p.key === pageKey) ?? null;
}

export async function saveSeoPage(pageKey: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.seo);
    const page = getPage(pageKey);
    if (!page) return fail("Unknown page.");
    const data = seoSchema.parse({
      title: fdOptional(fd, "title"),
      description: fdOptional(fd, "description"),
      primaryTopic: fdOptional(fd, "primaryTopic"),
      ogTitle: fdOptional(fd, "ogTitle"),
      ogDescription: fdOptional(fd, "ogDescription"),
      ogImageId: fdOptional(fd, "ogImageId"),
      noindex: !fdBool(fd, "indexable"),
      canonicalUrl: fdOptional(fd, "canonicalUrl"),
      breadcrumbLabel: fdOptional(fd, "breadcrumbLabel"),
    });

    const important = page.indexable && (page.group === "core" || page.group === "service");
    if (data.noindex && important && !fdBool(fd, "confirmNoindex")) {
      return fail("This is an important page. Tick the confirmation box if you really want to hide it from Google.", {
        confirmNoindex: "Please confirm you want to hide this page from Google.",
      });
    }
    if (data.ogImageId && !(await db.mediaAsset.findUnique({ where: { id: data.ogImageId }, select: { id: true } }))) {
      return fail("The selected sharing image no longer exists.", { ogImageId: "Choose another image." });
    }

    // Values identical to the built-in defaults are stored as "use default".
    const record = {
      ...data,
      title: data.title === page.defaultTitle ? null : data.title,
      description: data.description === page.defaultDescription ? null : data.description,
      primaryTopic: data.primaryTopic === page.primaryTopic ? null : data.primaryTopic,
      breadcrumbLabel: data.breadcrumbLabel === page.breadcrumb ? null : data.breadcrumbLabel,
    };
    const before = await db.sEOPageMetadata.findUnique({ where: { pageKey } });
    await db.sEOPageMetadata.upsert({ where: { pageKey }, create: { pageKey, ...record }, update: record });
    await logAudit({
      actor: admin,
      action: "seo.page.update",
      entityType: "SEOPageMetadata",
      entityId: pageKey,
      summary: `Updated SEO for ${page.label}${before && before.noindex !== record.noindex ? (record.noindex ? " (hidden from Google)" : " (indexing on)") : ""}`,
      changes: { title: record.title, description: record.description, noindex: record.noindex, canonicalUrl: record.canonicalUrl },
    });
    revalidatePath("/admin/seo");
    revalidatePath(`/admin/seo/${pageKey}`);
    revalidatePublicSite();
    return ok("SEO settings saved");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function resetSeoPage(pageKey: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.seo);
    const page = getPage(pageKey);
    if (!page) return fail("Unknown page.");
    await db.sEOPageMetadata.deleteMany({ where: { pageKey } });
    await logAudit({ actor: admin, action: "seo.page.reset", entityType: "SEOPageMetadata", entityId: pageKey, summary: `Reset SEO for ${page.label} to defaults` });
    revalidatePath("/admin/seo");
    revalidatePath(`/admin/seo/${pageKey}`);
    revalidatePublicSite();
    return ok("Restored the default SEO settings");
  } catch (error) {
    return handleActionError(error);
  }
}
