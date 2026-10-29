import { describe, expect, it } from "vitest";
import { basisPointsToPercentLabel, centsToInputValue, formatMoney, parseMoneyToCents, percentToBasisPoints } from "@/lib/money";
import { addDaysToDateString, utcToZonedInputValue, zonedDateString, zonedLocalToUtc } from "@/lib/time";
import { canonicalEmail, normalizeEmail, normalizePhone } from "@/lib/identity";
import { isInstagramUrl, isSafeHref, normalizePath, slugify } from "@/lib/urls";
import { whatsappLink } from "@/lib/whatsapp";

describe("money", () => {
  it("parses euro input without floating point errors", () => {
    expect(parseMoneyToCents("12")).toBe(1200);
    expect(parseMoneyToCents("12.5")).toBe(1250);
    expect(parseMoneyToCents("12,50")).toBe(1250);
    expect(parseMoneyToCents("€ 0.10")).toBe(10);
    expect(parseMoneyToCents("19.99")).toBe(1999);
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("12.345")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
  });

  it("formats cents and round-trips input values", () => {
    expect(formatMoney(12000)).toContain("120.00");
    expect(centsToInputValue(1205)).toBe("12.05");
    expect(centsToInputValue(null)).toBe("");
  });

  it("converts percentages to basis points", () => {
    expect(percentToBasisPoints("20")).toBe(2000);
    expect(percentToBasisPoints("12.5")).toBe(1250);
    expect(percentToBasisPoints("0")).toBeNull();
    expect(percentToBasisPoints("101")).toBeNull();
    expect(basisPointsToPercentLabel(1250)).toBe("12.5");
    expect(basisPointsToPercentLabel(2000)).toBe("20");
  });
});

describe("Europe/Malta time zone", () => {
  it("converts Malta wall-clock time to UTC in winter (CET, UTC+1)", () => {
    expect(zonedLocalToUtc("2026-10-31T23:59")!.toISOString()).toBe("2026-10-31T22:59:00.000Z");
    expect(zonedLocalToUtc("2026-12-25T00:00")!.toISOString()).toBe("2026-12-24T23:00:00.000Z");
  });

  it("converts Malta wall-clock time to UTC in summer (CEST, UTC+2)", () => {
    expect(zonedLocalToUtc("2026-07-01T12:00")!.toISOString()).toBe("2026-07-01T10:00:00.000Z");
  });

  it("handles the October DST change (25 Oct 2026)", () => {
    expect(zonedLocalToUtc("2026-10-25T01:30")!.toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(zonedLocalToUtc("2026-10-25T04:00")!.toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });

  it("round-trips input values", () => {
    const utc = zonedLocalToUtc("2026-11-27T18:30")!;
    expect(utcToZonedInputValue(utc)).toBe("2026-11-27T18:30");
  });

  it("rejects invalid dates", () => {
    expect(zonedLocalToUtc("2026-02-31T10:00")).toBeNull();
    expect(zonedLocalToUtc("not a date")).toBeNull();
  });

  it("computes Malta calendar dates", () => {
    expect(zonedDateString(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
    expect(addDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("identity normalisation", () => {
  it("normalises emails and canonicalises mailbox aliases", () => {
    expect(normalizeEmail("  John@Example.COM ")).toBe("john@example.com");
    expect(canonicalEmail("John.Smith+promo@gmail.com")).toBe("johnsmith@gmail.com");
    expect(canonicalEmail("j.smith+x@company.mt")).toBe("j.smith@company.mt");
  });

  it("normalises Maltese and international phone numbers to E.164", () => {
    expect(normalizePhone("7912 3456")).toBe("+35679123456");
    expect(normalizePhone("+356 7912 3456")).toBe("+35679123456");
    expect(normalizePhone("0035679123456")).toBe("+35679123456");
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("url helpers", () => {
  it("validates Instagram URLs", () => {
    expect(isInstagramUrl("https://www.instagram.com/p/abc123/")).toBe(true);
    expect(isInstagramUrl("https://instagram.com.evil.com/")).toBe(false);
    expect(isInstagramUrl("javascript:alert(1)")).toBe(false);
  });

  it("allows only safe CTA links", () => {
    expect(isSafeHref("/plans")).toBe(true);
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("//evil.com")).toBe(false);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
  });

  it("slugifies Maltese names", () => {
    expect(slugify("Gżira")).toBe("gzira");
    expect(slugify("St Julian's")).toBe("st-julian-s");
    expect(slugify("Chicken Pokébowl")).toBe("chicken-pokebowl");
  });

  it("normalises paths for redirects", () => {
    expect(normalizePath("/Old-Page/")).toBe("/old-page");
    expect(normalizePath("https://mcpreps.mt/menu?x=1")).toBe("/menu");
  });

  it("builds WhatsApp links only for valid numbers", () => {
    expect(whatsappLink("7912 3456", "Hi!")).toBe("https://wa.me/35679123456?text=Hi!");
    expect(whatsappLink("", "Hi")).toBeNull();
  });
});
