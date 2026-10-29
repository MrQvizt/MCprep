import { describe, expect, it } from "vitest";
import { setChecklistItemAction } from "@/app/admin/(dashboard)/launch/actions";
import { saveGoogleProfile, saveSearchConsole } from "@/app/admin/(dashboard)/listings/actions";
import { db } from "@/lib/db";
import { getChecklist, getLaunchReadiness, isValidChecklistKey, monthKey, MONTHLY_ITEMS } from "@/lib/launch";
import { getSettings, updateSettingsGroup } from "@/lib/settings";
import { createPlan, signInAs } from "./helpers";
import { createOrderRow, formData } from "./seo.fixtures";

const prev = { ok: false };
const item = async (key: string) => (await getLaunchReadiness()).items.find((i) => i.key === key)!;

describe("launch readiness", () => {
  it("starts with real gaps and never reports fabricated progress", async () => {
    const r = await getLaunchReadiness();
    expect(r.total).toBeGreaterThan(15);
    for (const key of ["logo", "order_email", "whatsapp", "test_order", "gbp", "search_console", "prices"]) {
      expect((await item(key)).status).not.toBe("done");
    }
    expect((await item("instagram")).status).toBe("done"); // configured brand default
    expect((await item("demo_notice")).status).toBe("todo");
  });

  it("updates automatically from real data", async () => {
    await createPlan({ slug: "2-weeks", priceCents: 12000 });
    await db.plan.create({ data: { slug: "demo", name: "Demo", durationDays: 7, priceCents: 5000, isDemo: true } });
    expect((await item("prices")).status).toBe("todo");
    await db.plan.updateMany({ data: { isDemo: false } });
    expect((await item("prices")).status).toBe("done");

    expect((await item("test_order")).status).toBe("todo");
    await createOrderRow();
    expect((await item("test_order")).status).toBe("done");

    await updateSettingsGroup("contact", { whatsappNumber: "+356 7912 3456", orderNotificationEmails: ["orders@example.com"] });
    await updateSettingsGroup("site", { showDemoNotice: false });
    expect((await item("whatsapp")).status).toBe("done");
    expect((await item("order_email")).status).toBe("done");
    expect((await item("demo_notice")).status).toBe("done");
  });

  it("treats delivery as confirmed only with an available locality (or when delivery is off)", async () => {
    expect((await item("delivery_areas")).status).toBe("todo");
    await db.deliveryArea.create({ data: { name: "Sliema", slug: "sliema", isPublished: true, deliveryAvailable: true } });
    expect((await item("delivery_areas")).status).toBe("done");
  });
});

describe("checklists", () => {
  it("only accepts known checklist keys", () => {
    expect(isValidChecklistKey("launch.promo_eligibility_tested")).toBe(true);
    expect(isValidChecklistKey("gbp.verify")).toBe(true);
    expect(isValidChecklistKey(`monthly.${monthKey()}.review_performance`)).toBe(true);
    expect(isValidChecklistKey("monthly.2026-13.review_performance")).toBe(false);
    expect(isValidChecklistKey("launch.anything")).toBe(false);
    expect(isValidChecklistKey("settings.hack")).toBe(false);
  });

  it("lets an admin tick manual and monthly items; editors can't", async () => {
    await signInAs("EDITOR");
    expect((await setChecklistItemAction("launch.backups_confirmed", true)).ok).toBe(false);

    await signInAs("ADMIN");
    expect((await setChecklistItemAction("launch.backups_confirmed", true)).ok).toBe(true);
    expect((await item("backups_confirmed")).status).toBe("done");

    const key = `monthly.${monthKey()}.review_promotions`;
    expect((await setChecklistItemAction(`monthly.${monthKey()}.promotions`, true)).ok).toBe(true);
    expect((await setChecklistItemAction(key, true)).ok).toBe(false); // not a defined item
    const monthly = await getChecklist(`monthly.${monthKey()}`, MONTHLY_ITEMS);
    expect(monthly.find((m) => m.key === "promotions")?.done).toBe(true);
    expect((await setChecklistItemAction("launch.backups_confirmed", false)).ok).toBe(true);
    expect((await item("backups_confirmed")).status).toBe("todo");
  });
});

describe("Google & Search Console settings", () => {
  it("stores the Business Profile links and verification code (merging with other contact settings)", async () => {
    await signInAs("ADMIN");
    await updateSettingsGroup("contact", { phone: "+356 2100 0000" });
    const res = await saveGoogleProfile(prev, formData({ googleBusinessProfileUrl: "https://maps.app.goo.gl/abc", googleReviewUrl: "https://g.page/r/abc/review" }));
    expect(res.ok).toBe(true);
    const sc = await saveSearchConsole(prev, formData({ googleSiteVerification: '<meta name="google-site-verification" content="Token_12345" />' }));
    expect(sc.ok).toBe(true);
    const s = await getSettings();
    expect(s.contact.googleBusinessProfileUrl).toBe("https://maps.app.goo.gl/abc");
    expect(s.contact.phone).toBe("+356 2100 0000");
    expect(s.seo.googleSiteVerification).toBe("Token_12345");
    expect((await item("gbp")).status).toBe("done");
    expect((await item("search_console")).status).toBe("done");
  });

  it("rejects unsafe links and malformed verification codes", async () => {
    await signInAs("ADMIN");
    expect((await saveGoogleProfile(prev, formData({ googleBusinessProfileUrl: "javascript:alert(1)" }))).ok).toBe(false);
    const bad = await saveSearchConsole(prev, formData({ googleSiteVerification: '"><script>' }));
    expect(bad.ok).toBe(false);
    expect(bad.fieldErrors?.googleSiteVerification).toBeTruthy();
  });
});
