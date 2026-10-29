import { describe, expect, it } from "vitest";
import { createPreviewLink, deleteCategory, saveBlogPost, saveCategory } from "@/app/admin/(dashboard)/blog/actions";
import { blogVisibility } from "@/lib/admin/blog-utils";
import { db } from "@/lib/db";
import { getSitemapEntries } from "@/lib/seo/sitemap";
import { utcToZonedInputValue } from "@/lib/time";
import { signInAs } from "./helpers";
import { createPost, expectRedirect, formData } from "./seo.fixtures";

const BODY = `<p>${"Practical meal prep advice for busy weeks in Malta. ".repeat(40)}</p>`;
const prev = { ok: false };

function postForm(values: Record<string, string | boolean | null | undefined> = {}) {
  return formData({ title: "How to read macros", contentHtml: BODY, excerpt: "What the numbers mean.", needsReview: true, ...values });
}

describe("blog CMS", () => {
  it("lets a content editor create a draft (redirects to the editor)", async () => {
    await signInAs("EDITOR");
    const target = await expectRedirect(() => saveBlogPost(null, prev, postForm({ intent: "save" })));
    const post = await db.blogPost.findFirstOrThrow({ where: { slug: "how-to-read-macros" } });
    expect(target).toBe(`/admin/blog/${post.id}?created=1`);
    expect(post.status).toBe("DRAFT");
    expect(post.needsReview).toBe(true);
  });

  it("rejects anonymous visitors", async () => {
    const res = await saveBlogPost(null, prev, postForm());
    expect(res.ok).toBe(false);
    expect(await db.blogPost.count()).toBe(0);
  });

  it("requires a fact-check before publishing, then publishes", async () => {
    await signInAs("EDITOR");
    const post = await createPost({ slug: "draft-one", status: "DRAFT", publishAt: null, needsReview: true });

    const blocked = await saveBlogPost(post.id, prev, postForm({ slug: "draft-one", intent: "publish", needsReview: true }));
    expect(blocked.ok).toBe(false);
    expect(blocked.fieldErrors?.needsReview).toBeTruthy();
    expect((await db.blogPost.findUniqueOrThrow({ where: { id: post.id } })).status).toBe("DRAFT");

    const published = await saveBlogPost(post.id, prev, postForm({ slug: "draft-one", intent: "publish", needsReview: false }));
    expect(published.ok).toBe(true);
    const after = await db.blogPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(blogVisibility(after)).toBe("PUBLISHED");
    expect((await getSitemapEntries()).some((e) => e.url.endsWith("/blog/draft-one"))).toBe(true);
  });

  it("schedules articles for the future (not visible until then) and rejects past times", async () => {
    await signInAs("ADMIN");
    const post = await createPost({ slug: "later", status: "DRAFT", publishAt: null });
    const past = await saveBlogPost(post.id, prev, postForm({ slug: "later", intent: "schedule", needsReview: false, publishAtLocal: "2020-01-01T10:00" }));
    expect(past.ok).toBe(false);
    expect(past.fieldErrors?.publishAtLocal).toBeTruthy();

    const when = new Date(Date.now() + 3 * 86_400_000);
    const res = await saveBlogPost(post.id, prev, postForm({ slug: "later", intent: "schedule", needsReview: false, publishAtLocal: utcToZonedInputValue(when) }));
    expect(res.ok).toBe(true);
    const after = await db.blogPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(blogVisibility(after)).toBe("SCHEDULED");
    expect((await getSitemapEntries()).some((e) => e.url.endsWith("/blog/later"))).toBe(false);
  });

  it("creates a 301 redirect when a live article's address changes", async () => {
    await signInAs("EDITOR");
    const post = await createPost({ slug: "old-address" });
    const res = await saveBlogPost(post.id, prev, postForm({ slug: "new-address", intent: "publish", needsReview: false, createRedirect: true }));
    expect(res.ok).toBe(true);
    const rule = await db.redirectRule.findUniqueOrThrow({ where: { fromPath: "/blog/old-address" } });
    expect(rule.toPath).toBe("/blog/new-address");
    expect(rule.statusCode).toBe(301);
  });

  it("does not allow two articles with the same address", async () => {
    await signInAs("EDITOR");
    await createPost({ slug: "taken" });
    const res = await saveBlogPost(null, prev, postForm({ slug: "taken" }));
    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.slug).toBeTruthy();
  });

  it("sanitises article HTML and only bumps the last-updated date when content changes", async () => {
    await signInAs("EDITOR");
    const post = await createPost({ slug: "clean", contentHtml: BODY, title: "How to read macros", excerpt: "What the numbers mean." });
    const original = post.contentUpdatedAt;

    await saveBlogPost(post.id, prev, postForm({ slug: "clean", intent: "save", needsReview: false, seoTitle: "Macros explained" }));
    const metaOnly = await db.blogPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(metaOnly.contentUpdatedAt.getTime()).toBe(original.getTime());
    expect(metaOnly.seoTitle).toBe("Macros explained");

    await saveBlogPost(
      post.id,
      prev,
      postForm({ slug: "clean", intent: "save", needsReview: false, contentHtml: `${BODY}<script>alert(1)</script><p onclick="x()">New</p>` }),
    );
    const changed = await db.blogPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(changed.contentHtml).not.toContain("<script");
    expect(changed.contentHtml).not.toContain("onclick");
    expect(changed.contentUpdatedAt.getTime()).toBeGreaterThan(original.getTime());
  });

  it("refuses to keep a live article flagged for fact-checking", async () => {
    await signInAs("EDITOR");
    const post = await createPost({ slug: "live-one" });
    const res = await saveBlogPost(post.id, prev, postForm({ slug: "live-one", intent: "save", needsReview: true }));
    expect(res.ok).toBe(false);
  });

  it("generates a private preview link for drafts", async () => {
    await signInAs("EDITOR");
    const post = await createPost({ slug: "preview-me", status: "DRAFT", publishAt: null });
    const res = await createPreviewLink(post.id);
    expect(res.ok).toBe(true);
    const token = (await db.blogPost.findUniqueOrThrow({ where: { id: post.id } })).previewToken;
    expect(token).toBeTruthy();
    expect(res.data?.url).toBe(`/blog/preview-me?preview=${token}`);
  });

  it("manages categories; deleting one keeps its articles", async () => {
    await signInAs("EDITOR");
    expect((await saveCategory(null, prev, formData({ name: "Meal Prep" }))).ok).toBe(true);
    const category = await db.blogCategory.findFirstOrThrow({ where: { slug: "meal-prep" } });
    const post = await createPost({ slug: "in-category" });
    await db.blogPost.update({ where: { id: post.id }, data: { categoryId: category.id } });
    expect((await deleteCategory(category.id)).ok).toBe(true);
    expect((await db.blogPost.findUniqueOrThrow({ where: { id: post.id } })).categoryId).toBeNull();
  });
});
