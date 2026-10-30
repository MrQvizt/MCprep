import { describe, expect, it } from "vitest";
import { CONTENT_KEYS, defaultContent } from "@/lib/content/schema";
import { defaultSettings, SETTINGS_GROUPS } from "@/lib/settings/schema";
import { HALLOWEEN_PROMOTION } from "../../prisma/seed-content";
import { INTRO_OFFER, MENU, PACKAGES } from "../../prisma/releases/menu-and-packages";
import { perMealCents } from "@/lib/packages";

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

  it("uses exactly the package prices the owner supplied", () => {
    const perMeal = Object.fromEntries(PACKAGES.map((p) => [p.slug, perMealCents(p)]));
    expect(perMeal).toEqual({
      "lunch-5-days": 1050,
      "lunch-7-days": 1000,
      "lunch-dinner-5-days": 950,
      "lunch-dinner-7-days": 850,
      "monthly-lunch-dinner-5-days": 900,
      "monthly-lunch-dinner-7-days": 804,
    });
    const monthly = PACKAGES.filter((p) => p.isSubscription).map((p) => [p.mealsPerDay * p.daysPerWeek, p.priceCents]);
    expect(monthly).toEqual([
      [10, 36000],
      [14, 45000],
    ]);
    expect(PACKAGES.filter((p) => p.isRecommended)).toHaveLength(1);
  });

  it("keeps the owner's menu card macros", () => {
    expect(MENU.map((m) => [m.name, m.calories, m.proteinG, m.carbsG, m.fatG])).toEqual([
      ["Chicken Poke Bowl", 544, 45, 63, 7],
      ["Honey Sriracha Chicken and Rice", 540, 40, 64, 8],
      ["Mexican Beef Bowl", 528, 39, 68, 7],
      ["Pepper Pesto Pasta", 564, 45, 72, 10],
      ["Biscoff Cheesecake", 397, 30, 56, 4],
    ]);
  });

  it("prices the intro offer at €6 a meal for the first week with a 2-hour personal window", () => {
    expect(INTRO_OFFER).toMatchObject({
      discountType: "FIRST_WEEK_MEAL_PRICE",
      discountValue: 600,
      audience: "NEW_CUSTOMERS",
      personalWindowMinutes: 120,
    });
  });

  it("uses an example-only discount in the Halloween campaign copy via a token", () => {
    expect(HALLOWEEN_PROMOTION.description).toContain("{discount}");
    expect(HALLOWEEN_PROMOTION.audience).toBe("NEW_CUSTOMERS");
  });
});
