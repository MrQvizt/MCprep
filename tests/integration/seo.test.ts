import { describe, expect, it } from "vitest";
import { resetSeoPage, saveSeoPage } from "@/app/admin/(dashboard)/seo/actions";
import { db } from "@/lib/db";
import { getSeoOverview } from "@/lib/seo/quality";
import { signInAs } from "./helpers";
import { createMeal, createPost, formData } from "./seo.fixtures";

const prev = { ok: false };
const codes = async () => (await getSeoOverview()).issues;

describe("SEO quality assistant", () => {
  it("lists every public page with its effective title", async () => {
    await createPost({ slug: "article-a", title: "Article A" });
    await createMeal({ slug: "chicken-pokebowl" });
    const { pages } = await getSeoOverview();
    const home = pages.find((p) => p.path === "/")!;
    expect(home.title).toBe("MC PREPS Malta | Macro-Tracked Meal Prep & High-Protein Meals");
    expect(home.indexable).toBe(true);
    expect(pages.find((p) => p.path === "/blog/article-a")?.kind).toBe("blog");
    expect(pages.find((p) => p.path === "/menu/chicken-pokebowl")?.kind).toBe("meal");
    expect(pages.find((p) => p.path === "/order")?.indexable).toBe(false);
  });

  it("flags a published article with no description in plain language", async () => {
    await createPost({ slug: "no-desc", title: "No description here", excerpt: null });
    const issue = (await codes()).find((i) => i.code === "MISSING_DESCRIPTION" && i.path === "/blog/no-desc");
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/no SEO description/);
    expect(issue!.href).toMatch(/^\/admin\/blog\//);
  });

  it("detects duplicate titles", async () => {
    await db.sEOPageMetadata.create({ data: { pageKey: "menu", title: "Same title | MC PREPS" } });
    await db.sEOPageMetadata.create({ data: { pageKey: "plans", title: "Same title | MC PREPS" } });
    const dupes = (await codes()).filter((i) => i.code === "DUPLICATE_TITLE");
    expect(dupes.map((d) => d.path).sort()).toEqual(["/menu", "/plans"]);
  });

  it("detects broken internal links but accepts real pages and redirected addresses", async () => {
    await createMeal({ slug: "chicken-pokebowl" });
    await db.redirectRule.create({ data: { fromPath: "/old-plans", toPath: "/plans" } });
    await createPost({
      slug: "linky",
      contentHtml: `<p>${"Words ".repeat(320)}</p><p><a href="/menu/chicken-pokebowl">meal</a> <a href="/old-plans">plans</a> <a href="/menu/ghost-meal">ghost</a></p>`,
    });
    const broken = (await codes()).filter((i) => i.code === "BROKEN_LINK");
    expect(broken).toHaveLength(1);
    expect(broken[0].message).toContain("/menu/ghost-meal");
    expect(broken[0].severity).toBe("error");
  });

  it("flags thin articles, hidden important pages, redirect loops and missing business details", async () => {
    await createPost({ slug: "thin", contentHtml: "<p>Too short.</p>" });
    await db.sEOPageMetadata.create({ data: { pageKey: "meal-prep-malta", noindex: true } });
    await db.redirectRule.createMany({ data: [{ fromPath: "/x", toPath: "/y" }, { fromPath: "/y", toPath: "/x" }] });
    const issues = await codes();
    const has = (code: string) => issues.some((i) => i.code === code);
    expect(has("THIN_CONTENT")).toBe(true);
    expect(issues.find((i) => i.code === "NOINDEX_IMPORTANT")?.path).toBe("/meal-prep-malta");
    expect(has("REDIRECT_LOOP")).toBe(true);
    expect(has("SCHEMA_PHONE")).toBe(true);
    expect(has("SCHEMA_LOGO")).toBe(true);
    // errors are listed first
    expect(issues[0].severity).toBe("error");
  });
});

describe("per-page SEO editor", () => {
  it("saves overrides (content editors are allowed) and restores defaults", async () => {
    await signInAs("EDITOR");
    const res = await saveSeoPage(
      "meal-prep-malta",
      prev,
      formData({ title: "Meal Prep Malta | Weekly Meals | MC PREPS", description: "Fresh weekly meal prep in Malta.", indexable: true }),
    );
    expect(res.ok).toBe(true);
    const row = await db.sEOPageMetadata.findUniqueOrThrow({ where: { pageKey: "meal-prep-malta" } });
    expect(row.title).toBe("Meal Prep Malta | Weekly Meals | MC PREPS");
    expect(row.noindex).toBe(false);

    expect((await resetSeoPage("meal-prep-malta")).ok).toBe(true);
    expect(await db.sEOPageMetadata.count()).toBe(0);
  });

  it("requires confirmation before hiding an important page, and validates canonicals", async () => {
    await signInAs("EDITOR");
    const hide = await saveSeoPage("plans", prev, formData({}));
    expect(hide.ok).toBe(false);
    expect(hide.fieldErrors?.confirmNoindex).toBeTruthy();
    expect((await saveSeoPage("plans", prev, formData({ confirmNoindex: true }))).ok).toBe(true);
    expect((await db.sEOPageMetadata.findUniqueOrThrow({ where: { pageKey: "plans" } })).noindex).toBe(true);

    const bad = await saveSeoPage("about", prev, formData({ indexable: true, canonicalUrl: "javascript:alert(1)" }));
    expect(bad.ok).toBe(false);
    expect(bad.fieldErrors?.canonicalUrl).toBeTruthy();
  });

  it("rejects unknown pages and anonymous users", async () => {
    expect((await saveSeoPage("plans", prev, formData({ indexable: true }))).ok).toBe(false);
    await signInAs("EDITOR");
    expect((await saveSeoPage("not-a-page", prev, formData({ indexable: true }))).ok).toBe(false);
  });
});
