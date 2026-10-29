import { describe, expect, it } from "vitest";
import { runHealthCheckNow } from "@/app/admin/(dashboard)/health/actions";
import { db } from "@/lib/db";
import { getLatestHealthCheck, runSiteHealthCheck } from "@/lib/site-health";
import { createPromotion, signInAs } from "./helpers";
import { createMeal } from "./seo.fixtures";

describe("site health check", () => {
  it("stores a result with operational and SEO issues", async () => {
    await db.emailOutbox.create({
      data: { type: "ORDER_BUSINESS_NOTIFICATION", dedupeKey: "dead-1", toAddress: "a@b.c", subject: "s", html: "h", text: "t", status: "DEAD" },
    });
    await createPromotion({ slug: "ending", endsAt: new Date(Date.now() + 10 * 3_600_000) });
    await createMeal({ slug: "no-photo", name: "No Photo Bowl" });

    const result = await runSiteHealthCheck("scheduled");
    const codes = result.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["EMAIL_DEAD", "PROMO_ENDING", "MEAL_NO_PHOTO", "NO_ORDER_EMAIL", "LEGAL_REVIEW"]));
    expect(result.issues.some((i) => i.category === "seo")).toBe(true);
    expect(result.issueCount).toBe(result.issues.length);
    expect(result.issues[0].severity).toBe("error");

    const latest = await getLatestHealthCheck();
    expect(latest?.id).toBe(result.id);
    expect(latest?.trigger).toBe("scheduled");
  });

  it("can be run from the admin by a content editor", async () => {
    await signInAs("EDITOR");
    const res = await runHealthCheckNow();
    expect(res.ok).toBe(true);
    expect(await db.siteHealthCheck.count()).toBe(1);
  });

  it("is not available to anonymous visitors", async () => {
    const res = await runHealthCheckNow();
    expect(res.ok).toBe(false);
    expect(await db.siteHealthCheck.count()).toBe(0);
  });
});
