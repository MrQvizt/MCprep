import { describe, expect, it } from "vitest";
import { renderBusinessOrderEmail, renderCustomerOrderEmail, type OrderEmailData } from "@/lib/email/templates";
import { escapeHtml, safeHeader } from "@/lib/email/escape";
import { nextAttemptDelayMs } from "@/lib/email/outbox-backoff";

const brand = {
  tradingName: "MC PREPS",
  timeZone: "Europe/Malta",
  publicEmail: "hello@mcpreps.test",
  phone: "",
  whatsappLink: null,
  instagramUrl: "https://www.instagram.com/mcpreps.mt/",
  siteUrl: "https://mcpreps.test/",
};

const order: OrderEmailData = {
  reference: "MCP-000123",
  createdAt: new Date("2026-10-30T09:00:00Z"),
  customerName: "<script>alert(1)</script> Maria",
  customerEmail: "maria@example.com",
  customerPhone: "+356 7912 3456",
  whatsappNumber: null,
  planName: "2 Weeks",
  planDurationDays: 14,
  planMealsIncluded: null,
  currency: "EUR",
  basePriceCents: 12000,
  deliveryFeeCents: 0,
  discountCents: 2400,
  totalCents: 9600,
  promotionName: "Halloween Special",
  promotionCode: null,
  promotionEndsAt: new Date("2026-10-31T22:59:00Z"),
  promotionRequiresVerification: true,
  eligibilityStatus: "LIKELY_INELIGIBLE",
  eligibilityReasons: ["PRIOR_CONFIRMED_ORDER"],
  isReturningCustomer: true,
  isPotentialDuplicate: false,
  fulfillmentMethod: "COLLECTION",
  deliveryLocality: null,
  addressLine1: null,
  addressLine2: null,
  postalCode: null,
  collectionPointName: null,
  preferredStartDate: "2026-11-02",
  mealPreference: null,
  dietaryPreferences: null,
  allergies: "Peanuts",
  specialInstructions: null,
  notes: null,
  marketingOptIn: false,
};

describe("order emails", () => {
  it("escapes customer input in HTML", () => {
    const email = renderBusinessOrderEmail(order, brand, "https://mcpreps.test/admin/orders/x");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("flags promotions needing verification for the business", () => {
    const email = renderBusinessOrderEmail(order, brand, "https://mcpreps.test/admin/orders/x");
    expect(email.subject).toContain("MCP-000123");
    expect(email.subject).toContain("verification");
    expect(email.text).toContain("Returning customer");
    expect(email.text).toContain("€120.00");
    expect(email.text).toContain("Payment: Not collected");
    expect(email.text).toContain("Peanuts");
  });

  it("tells the customer nothing was paid and the offer is subject to verification, without revealing checks", () => {
    const email = renderCustomerOrderEmail(order, brand);
    expect(email.text).toContain("No payment has been taken");
    expect(email.text).toContain("Eligibility is confirmed by our team");
    expect(email.text).not.toMatch(/returning|ineligible|previous order/i);
    expect(email.html).not.toContain("Peanuts"); // allergy details are not repeated by email
  });

  it("sanitises header values and HTML", () => {
    expect(safeHeader("Hello\r\nBcc: x@y.z")).not.toMatch(/[\r\n]/);
    expect(escapeHtml(`"'<>&`)).toBe("&quot;&#39;&lt;&gt;&amp;");
  });

  it("backs off between retries", () => {
    expect(nextAttemptDelayMs(1)).toBe(60_000);
    expect(nextAttemptDelayMs(2)).toBe(5 * 60_000);
    expect(nextAttemptDelayMs(50)).toBe(24 * 60 * 60_000);
  });
});
