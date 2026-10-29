"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fdBool, fdOptional, fdString, fail, handleActionError, ok, type ActionState } from "@/lib/actions";
import { blogVisibility, newPreviewToken, textFromHtml } from "@/lib/admin/blog";
import { moveItem, nextSortOrder } from "@/lib/admin/reorder";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { createSlugChangeRedirect } from "@/lib/redirects";
import { revalidatePublicSite } from "@/lib/revalidate";
import { sanitizeRichText } from "@/lib/sanitize";
import { DEFAULT_TIME_ZONE, zonedLocalToUtc } from "@/lib/time";
import { isSafeHttpUrl, isSafeInternalPath, slugify, SLUG_RE } from "@/lib/urls";

const opt = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .nullable()
    .transform((v) => (v ? v : null));

const postSchema = z.object({
  title: z.string().trim().min(3, "Give the article a title.").max(160, "Keep the title under 160 characters."),
  slug: z.string().trim().max(80).regex(SLUG_RE, "Use lower-case letters, numbers and dashes only (e.g. meal-prep-tips)."),
  excerpt: opt(300, "The summary"),
  contentHtml: z.string().max(200_000, "The article is too long."),
  coverImageId: z.string().nullable(),
  coverAlt: opt(200, "The cover description"),
  categoryId: z.string().nullable(),
  authorName: opt(80, "The author name"),
  authorBio: opt(500, "The author bio"),
  authorUrl: opt(300, "The author link").refine((v) => v === null || isSafeHttpUrl(v), "Use a full https:// link."),
  isFeatured: z.boolean(),
  needsReview: z.boolean(),
  seoTitle: opt(120, "The Google title"),
  seoDescription: opt(320, "The SEO description"),
  primaryTopic: opt(120, "The search topic"),
  ogTitle: opt(120, "The social title"),
  ogDescription: opt(320, "The social description"),
  ogImageId: z.string().nullable(),
  canonicalUrl: opt(500, "The canonical URL").refine(
    (v) => v === null || isSafeInternalPath(v) || (isSafeHttpUrl(v) && v.startsWith("https://")),
    "Use a path starting with / or a full https:// address.",
  ),
  noindex: z.boolean(),
});

const INTENTS = ["save", "draft", "publish", "schedule", "unpublish"] as const;
type Intent = (typeof INTENTS)[number];

function refresh(id?: string) {
  revalidatePath("/admin/blog");
  if (id) revalidatePath(`/admin/blog/${id}`);
  revalidatePath("/admin/seo");
  revalidatePublicSite();
}

export async function saveBlogPost(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const admin = await assertAdmin(AREA_ROLES.blog);
    const intentRaw = fdString(fd, "intent") || "save";
    const intent: Intent = (INTENTS as readonly string[]).includes(intentRaw) ? (intentRaw as Intent) : "save";
    const title = fdString(fd, "title");
    const data = postSchema.parse({
      title,
      slug: fdString(fd, "slug") || slugify(title),
      excerpt: fdOptional(fd, "excerpt"),
      contentHtml: sanitizeRichText(fdString(fd, "contentHtml")),
      coverImageId: fdOptional(fd, "coverImageId"),
      coverAlt: fdOptional(fd, "coverAlt"),
      categoryId: fdOptional(fd, "categoryId"),
      authorName: fdOptional(fd, "authorName"),
      authorBio: fdOptional(fd, "authorBio"),
      authorUrl: fdOptional(fd, "authorUrl"),
      isFeatured: fdBool(fd, "isFeatured"),
      needsReview: fdBool(fd, "needsReview"),
      seoTitle: fdOptional(fd, "seoTitle"),
      seoDescription: fdOptional(fd, "seoDescription"),
      primaryTopic: fdOptional(fd, "primaryTopic"),
      ogTitle: fdOptional(fd, "ogTitle"),
      ogDescription: fdOptional(fd, "ogDescription"),
      ogImageId: fdOptional(fd, "ogImageId"),
      canonicalUrl: fdOptional(fd, "canonicalUrl"),
      noindex: fdBool(fd, "noindex"),
    });

    const existing = id ? await db.blogPost.findUnique({ where: { id } }) : null;
    if (id && !existing) return fail("This article no longer exists.");

    const clash = await db.blogPost.findFirst({ where: { slug: data.slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) return fail("Another article already uses this address.", { slug: "Another article already uses this address. Choose a different one." });
    if (data.categoryId && !(await db.blogCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) {
      return fail("That category no longer exists.", { categoryId: "Choose another category." });
    }
    for (const mediaField of ["coverImageId", "ogImageId"] as const) {
      const mid = data[mediaField];
      if (mid && !(await db.mediaAsset.findUnique({ where: { id: mid }, select: { id: true } }))) {
        return fail("A selected image no longer exists.", { [mediaField]: "Choose another image." });
      }
    }

    // ── Publishing rules ───────────────────────────────────────────────────
    const now = new Date();
    let status = existing?.status ?? "DRAFT";
    let publishAt = existing?.publishAt ?? null;
    const wasVisible = existing ? blogVisibility(existing, now) === "PUBLISHED" : false;
    const reviewError = {
      needsReview: "Untick “Needs fact-check” once the facts, figures and claims have been checked.",
    };
    const hasBody = textFromHtml(data.contentHtml).length > 0;

    if (intent === "draft" || intent === "unpublish") {
      status = "DRAFT";
    } else if (intent === "publish") {
      if (data.needsReview) return fail("Please confirm the article has been fact-checked before publishing.", reviewError);
      if (!hasBody) return fail("Write the article before publishing it.", { contentHtml: "The article is empty." });
      status = "PUBLISHED";
      publishAt = wasVisible && existing?.publishAt ? existing.publishAt : now;
    } else if (intent === "schedule") {
      if (data.needsReview) return fail("Please confirm the article has been fact-checked before scheduling it.", reviewError);
      if (!hasBody) return fail("Write the article before scheduling it.", { contentHtml: "The article is empty." });
      const when = zonedLocalToUtc(fdString(fd, "publishAtLocal"), DEFAULT_TIME_ZONE);
      if (!when) return fail("Choose when the article should go live.", { publishAtLocal: "Pick a date and time." });
      if (when.getTime() <= now.getTime()) return fail("The scheduled time is in the past.", { publishAtLocal: "Pick a time in the future, or use “Publish now”." });
      status = "PUBLISHED";
      publishAt = when;
    } else if (status === "PUBLISHED" && data.needsReview) {
      return fail("A live article can't be marked as needing a fact-check. Unpublish it first, or untick the box.", reviewError);
    }

    const contentChanged =
      !existing || existing.title !== data.title || existing.contentHtml !== data.contentHtml || (existing.excerpt ?? null) !== data.excerpt;

    const record = {
      ...data,
      status,
      publishAt,
      ...(contentChanged ? { contentUpdatedAt: now } : {}),
    };

    let postId = id;
    if (existing) {
      await db.blogPost.update({ where: { id: existing.id }, data: record });
      if (existing.slug !== data.slug && wasVisible && fdBool(fd, "createRedirect")) {
        await createSlugChangeRedirect(`/blog/${existing.slug}`, `/blog/${data.slug}`, `Blog article “${data.title}” moved`);
      }
    } else {
      const created = await db.blogPost.create({ data: record });
      postId = created.id;
      createdId = created.id;
    }

    const verb =
      intent === "publish" ? "Published" : intent === "schedule" ? "Scheduled" : intent === "unpublish" ? "Unpublished" : existing ? "Updated" : "Created";
    await logAudit({
      actor: admin,
      action: `blog.${intent === "save" ? (existing ? "update" : "create") : intent}`,
      entityType: "BlogPost",
      entityId: postId,
      summary: `${verb} article “${data.title}”${intent === "schedule" && publishAt ? ` for ${publishAt.toISOString()}` : ""}`,
    });
    refresh(postId ?? undefined);

    if (!createdId) {
      const messages: Record<Intent, string> = {
        save: "Changes saved",
        draft: "Saved as draft",
        publish: wasVisible ? "Article updated" : "Article published",
        schedule: "Article scheduled",
        unpublish: "Article unpublished",
      };
      return ok(messages[intent]);
    }
  } catch (error) {
    return handleActionError(error);
  }
  redirect(`/admin/blog/${createdId}?created=1`);
}

export async function deleteBlogPost(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.blog);
    const post = await db.blogPost.delete({ where: { id } });
    await logAudit({ actor: admin, action: "blog.delete", entityType: "BlogPost", entityId: id, summary: `Deleted article “${post.title}”` });
    refresh();
  } catch (error) {
    return handleActionError(error);
  }
  redirect("/admin/blog?deleted=1");
}

export async function createPreviewLink(id: string): Promise<ActionState<{ url: string }>> {
  try {
    await assertAdmin(AREA_ROLES.blog);
    const post = await db.blogPost.findUniqueOrThrow({ where: { id }, select: { slug: true, previewToken: true } });
    const token = post.previewToken ?? newPreviewToken();
    if (!post.previewToken) await db.blogPost.update({ where: { id }, data: { previewToken: token } });
    revalidatePath(`/admin/blog/${id}`);
    return ok("Preview link ready", { url: `/blog/${post.slug}?preview=${token}` });
  } catch (error) {
    return handleActionError(error);
  }
}

// ── Categories ──────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().trim().min(2, "Give the category a name.").max(60),
  slug: z.string().trim().max(60).regex(SLUG_RE, "Use lower-case letters, numbers and dashes."),
  description: opt(300, "The description"),
});

export async function saveCategory(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.blog);
    const name = fdString(fd, "name");
    const data = categorySchema.parse({ name, slug: fdString(fd, "slug") || slugify(name), description: fdOptional(fd, "description") });
    const clash = await db.blogCategory.findFirst({ where: { slug: data.slug, ...(id ? { id: { not: id } } : {}) } });
    if (clash) return fail("Another category already uses this address.", { slug: "Choose a different address." });
    if (id) {
      await db.blogCategory.update({ where: { id }, data });
    } else {
      await db.blogCategory.create({ data: { ...data, sortOrder: await nextSortOrder("blogCategory") } });
    }
    await logAudit({ actor: admin, action: id ? "blog.category.update" : "blog.category.create", entityType: "BlogCategory", entityId: id, summary: `${id ? "Updated" : "Created"} blog category “${data.name}”` });
    revalidatePath("/admin/blog/categories");
    revalidatePath("/admin/blog");
    revalidatePublicSite();
    return ok(id ? "Category saved" : "Category added");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteCategory(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.blog);
    const category = await db.blogCategory.delete({ where: { id } });
    await logAudit({ actor: admin, action: "blog.category.delete", entityType: "BlogCategory", entityId: id, summary: `Deleted blog category “${category.name}”` });
    revalidatePath("/admin/blog/categories");
    revalidatePublicSite();
    return ok("Category deleted. Its articles are now uncategorised.");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionState> {
  try {
    await assertAdmin(AREA_ROLES.blog);
    await moveItem("blogCategory", id, direction);
    revalidatePath("/admin/blog/categories");
    revalidatePublicSite();
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}
