import { describe, expect, it } from "vitest";
import { resetContentBlock, saveContentBlock } from "@/app/admin/(dashboard)/content/actions";
import { saveLandingPage } from "@/app/admin/(dashboard)/landing-pages/actions";
import { validateContentBlock } from "@/lib/admin/content-fields";
import { createLandingPage, parseLandingForm, updateLandingPage } from "@/lib/admin/landing-pages";
import { defaultContent, getContent } from "@/lib/content";
import { db } from "@/lib/db";
import { form, initial, runAction } from "./admin-form-utils";
import { signInAs } from "./helpers";

const hero = () => ({ ...defaultContent("home.hero") }) as Record<string, unknown>;

describe("content validation", () => {
  it("rejects unsafe or empty button links and required headings", () => {
    const bad = validateContentBlock("home.hero", { ...hero(), headline: "", primaryCta: { label: "Go", href: "javascript:alert(1)" } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.headline).toMatch(/required/);
      expect(bad.errors["primaryCta.href"]).toMatch(/\/plans/);
    }
    const tooLong = validateContentBlock("home.hero", { ...hero(), headline: "x".repeat(81) });
    expect(tooLong.ok).toBe(false);
    expect(validateContentBlock("home.hero", hero()).ok).toBe(true);
  });

  it("validates list items and drops unknown fields", () => {
    const res = validateContentBlock("home.benefits", {
      ...defaultContent("home.benefits"),
      items: [{ title: "", body: "x", icon: "rocket" }],
      hacker: "<script>",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors["items.0.title"]).toBeDefined();
      expect(res.errors["items.0.icon"]).toBeDefined();
    }
    const ok = validateContentBlock("home.benefits", { ...defaultContent("home.benefits"), hacker: "x" });
    expect(ok.ok && "hacker" in ok.value).toBe(false);
  });
});

describe("content editor actions", () => {
  it("saves valid content and returns field errors for bad links", async () => {
    await signInAs("EDITOR");
    const bad = await saveContentBlock("home.hero", initial, form({ data: JSON.stringify({ ...hero(), primaryCta: { label: "x", href: "//evil.com" } }) }));
    expect(bad.ok).toBe(false);
    expect(bad.fieldErrors?.["primaryCta.href"]).toBeDefined();
    expect(await db.pageContent.count()).toBe(0);

    const good = await saveContentBlock("home.hero", initial, form({ data: JSON.stringify({ ...hero(), headline: "Fuel every rep." }) }));
    expect(good.ok).toBe(true);
    expect((await getContent("home.hero")).headline).toBe("Fuel every rep.");

    const reset = await resetContentBlock("home.hero");
    expect(reset.ok).toBe(true);
    expect(await db.pageContent.count()).toBe(0);
  });

  it("sanitises legal page HTML and updates the last-updated date", async () => {
    await signInAs("ADMIN");
    const value = { ...defaultContent("legal.privacy"), html: '<p>Hello<script>alert(1)</script><a href="javascript:x">x</a></p>' };
    const res = await saveContentBlock("legal.privacy", initial, form({ data: JSON.stringify(value) }));
    expect(res.ok).toBe(true);
    const saved = (await db.pageContent.findUniqueOrThrow({ where: { key: "legal.privacy" } })).data as { html: string; lastUpdated: string };
    expect(saved.html).not.toContain("<script");
    expect(saved.html).not.toContain("javascript:");
    expect(saved.lastUpdated).not.toBe("");
  });

  it("rejects unknown content keys", async () => {
    await signInAs("ADMIN");
    const res = await saveContentBlock("nope", initial, form({ data: "{}" }));
    expect(res.ok).toBe(false);
  });
});

describe("offer landing pages", () => {
  const page = (o: Record<string, string | boolean> = {}) =>
    form({
      type: "SEASONAL",
      title: "Halloween",
      slug: "halloween",
      headline: "Halloween fuel deal",
      body: '<p>Order now<script>alert(1)</script></p><img src="x" onerror="alert(1)">',
      ctaText: "Claim",
      expiredBehavior: "SHOW_EXPIRED_MESSAGE",
      expiredMessage: "Ended",
      noindex: true,
      isPublished: true,
      ...o,
    });

  it("sanitises the body and redirects old addresses of published pages", async () => {
    const admin = await signInAs("ADMIN");
    const created = await createLandingPage(admin, parseLandingForm(page()));
    expect(created.body).toBe('<p>Order now</p><img src="x" />');
    expect(created.noindex).toBe(true);
    const { redirect } = await updateLandingPage(admin, created.id, parseLandingForm(page({ slug: "halloween-2026" })), { createRedirect: true });
    expect(redirect).toEqual({ from: "/offers/halloween", to: "/offers/halloween-2026" });
  });

  it("is restricted to administrators", async () => {
    await signInAs("EDITOR");
    const res = await runAction(() => saveLandingPage(null, initial, page()));
    expect(res.result?.ok).toBe(false);
    expect(await db.seasonalCampaignLandingPage.count()).toBe(0);
  });
});
