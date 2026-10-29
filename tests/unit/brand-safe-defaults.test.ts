import { describe, expect, it } from "vitest";
import { CONTENT_KEYS, defaultContent } from "@/lib/content/schema";
import { defaultSettings, SETTINGS_GROUPS } from "@/lib/settings/schema";
import { PLANS, HALLOWEEN_PROMOTION, MEAL_CHICKEN_POKEBOWL } from "../../prisma/seed-content";

/**
 * The site must not invent business facts. These tests guard the defaults and
 * seed data against accidental fabricated details.
 */
describe("brand-safe defaults", () => {
  it("leaves unknown contact and business details empty", () => {
    const contact = defaultSettings("contact");
    expect(contact.phone).toBe("");
    expect(contact.whatsappNumber).toBe("");
    expect(contact.publicEmail).toBe("");
    expect(contact.orderNotificationEmails).toEqual([]);
    expect(contact.instagramUrl).toBe("https://www.instagram.com/mcpreps.mt/");
    expect(contact.instagramHandle).toBe("mcpreps.mt");
    const business = defaultSettings("business");
    expect(business.addressLine1).toBe("");
    expect(business.openingHours).toEqual([]);
    expect(business.vatNumber).toBe("");
    expect(business.timeZone).toBe("Europe/Malta");
    expect(business.currency).toBe("EUR");
  });

  it("parses every settings group and content block with defaults", () => {
    for (const g of SETTINGS_GROUPS) expect(() => defaultSettings(g)).not.toThrow();
    for (const k of CONTENT_KEYS) expect(() => defaultContent(k)).not.toThrow();
  });

  it("contains no invented prices, fees, ratings or certifications in default copy", () => {
    const all = JSON.stringify([
      ...CONTENT_KEYS.filter((k) => !k.startsWith("legal.")).map((k) => defaultContent(k)),
      ...SETTINGS_GROUPS.map((g) => defaultSettings(g)),
    ]);
    expect(all).not.toMatch(/€\s?\d/);
    expect(all).not.toMatch(/\b\d(\.\d)?\s?(stars?|★)/i);
    expect(all).not.toMatch(/certified|award-winning|nutritionist-approved|dietitian-approved/i);
    expect(all).not.toMatch(/kitchen (that )?handles/i);
  });

  it("seeds plans without real prices (price on request) unless the demo profile is used", () => {
    // Real prices are entered by the owner; demo prices exist only for SEED_PROFILE=demo.
    for (const plan of PLANS) expect(plan).toHaveProperty("demoPriceCents");
    expect(PLANS.map((p) => p.name)).toEqual(["1 Week", "2 Weeks", "1 Month"]);
  });

  it("keeps the confirmed Chicken Pokébowl macros and marks them for verification", () => {
    expect(MEAL_CHICKEN_POKEBOWL).toMatchObject({ calories: 544, proteinG: 45, carbsG: 63, fatG: 7, nutritionVerified: false });
    expect(MEAL_CHICKEN_POKEBOWL.nutritionSource).toMatch(/Instagram/);
  });

  it("uses an example-only discount in the Halloween campaign copy via a token", () => {
    expect(HALLOWEEN_PROMOTION.description).toContain("{discount}");
    expect(HALLOWEEN_PROMOTION.audience).toBe("NEW_CUSTOMERS");
  });
});
