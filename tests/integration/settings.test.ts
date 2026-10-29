import { describe, expect, it } from "vitest";
import { saveSettingsSection } from "@/app/admin/(dashboard)/settings/actions";
import { sendTestEmail } from "@/lib/admin/test-email";
import { db } from "@/lib/db";
import type { EmailTransport, OutgoingEmail } from "@/lib/email/transport";
import { getSettings, updateSettingsGroup } from "@/lib/settings";
import { formData } from "./d2-helpers";
import { signInAs } from "./helpers";

const contactBase = {
  publicEmail: "hello@mcpreps.test",
  orderNotificationEmails: "orders@mcpreps.test\nowner@mcpreps.test",
  phone: "",
  whatsappNumber: "7912 3456",
  whatsappEnabled: true,
  whatsappDefaultMessage: "Hi!",
  whatsappOrderMessage: "Order {reference}",
  whatsappFollowUpMessage: "Hi {firstName}, about {reference} ({plan})",
  instagramUrl: "https://www.instagram.com/mcpreps.mt/",
  instagramHandle: "@mcpreps.mt",
  instagramDmEnabled: true,
};

describe("business settings", () => {
  it("validates contact details strictly", async () => {
    await signInAs("ADMIN");
    const bad = await saveSettingsSection(
      "contact",
      { ok: false },
      formData({
        ...contactBase,
        publicEmail: "not-an-email",
        orderNotificationEmails: "orders@mcpreps.test, nope",
        phone: "123",
        instagramUrl: "https://evil.example.com/mcpreps",
        whatsappFollowUpMessage: "Hi {name}",
      }),
    );
    expect(bad.ok).toBe(false);
    expect(Object.keys(bad.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["publicEmail", "orderNotificationEmails", "phone", "instagramUrl", "whatsappFollowUpMessage"]),
    );
    expect(await db.siteSetting.count({ where: { key: "contact" } })).toBe(0);
  });

  it("normalises phone numbers and merges without losing other fields", async () => {
    const admin = await signInAs("ADMIN");
    // Set on the listings screen (owned elsewhere) — must survive a contact save.
    await updateSettingsGroup("contact", { googleBusinessProfileUrl: "https://g.page/mcpreps" }, admin.id);
    const res = await saveSettingsSection("contact", { ok: false }, formData(contactBase));
    expect(res.ok).toBe(true);
    const { contact } = await getSettings();
    expect(contact.whatsappNumber).toBe("+356 7912 3456");
    expect(contact.instagramHandle).toBe("mcpreps.mt");
    expect(contact.orderNotificationEmails).toEqual(["orders@mcpreps.test", "owner@mcpreps.test"]);
    expect(contact.googleBusinessProfileUrl).toBe("https://g.page/mcpreps");
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "settings.contact" } });
    expect(JSON.stringify(log.changes)).toContain("whatsappNumber");
  });

  it("allows saving without a WhatsApp number (the button only appears once one is set)", async () => {
    await signInAs("ADMIN");
    const res = await saveSettingsSection("contact", { ok: false }, formData({ ...contactBase, whatsappNumber: "" }));
    expect(res.ok).toBe(true);
    expect((await getSettings()).contact.whatsappNumber).toBe("");
  });

  it("validates tracking IDs", async () => {
    await signInAs("ADMIN");
    const bad = await saveSettingsSection("tracking", { ok: false }, formData({ consentBannerEnabled: true, ga4MeasurementId: "UA-12345-1", metaPixelId: "abc" }));
    expect(bad.ok).toBe(false);
    expect(bad.fieldErrors?.ga4MeasurementId).toBeTruthy();
    expect(bad.fieldErrors?.metaPixelId).toBeTruthy();
    const good = await saveSettingsSection("tracking", { ok: false }, formData({ consentBannerEnabled: true, firstPartyAnalyticsEnabled: true, ga4MeasurementId: "g-abc123xyz" }));
    expect(good.ok).toBe(true);
    expect((await getSettings()).tracking.ga4MeasurementId).toBe("G-ABC123XYZ");
  });

  it("validates business details (VAT, postcode, opening hours, public address)", async () => {
    await signInAs("ADMIN");
    const bad = await saveSettingsSection(
      "business",
      { ok: false },
      formData({
        tradingName: "MC PREPS",
        businessType: "LocalBusiness",
        vatNumber: "12345",
        addressPostalCode: "12345",
        showAddressPublicly: true,
        hoursDay: [1],
        hoursOpens: ["18:00"],
        hoursCloses: ["09:00"],
        timeZone: "Europe/Malta",
        currency: "EUR",
      }),
    );
    expect(bad.ok).toBe(false);
    expect(Object.keys(bad.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["vatNumber", "addressPostalCode", "showAddressPublicly", "openingHours.0.closes"]),
    );
    const good = await saveSettingsSection(
      "business",
      { ok: false },
      formData({
        tradingName: "MC PREPS",
        businessType: "FoodEstablishment",
        vatNumber: "mt 1234 5678",
        addressPostalCode: "bkr1234",
        hoursDay: [1],
        hoursOpens: ["09:00"],
        hoursCloses: ["17:00"],
        timeZone: "Europe/Malta",
        currency: "EUR",
      }),
    );
    expect(good.ok).toBe(true);
    const { business } = await getSettings();
    expect(business).toMatchObject({ vatNumber: "MT12345678", addressPostalCode: "BKR 1234", businessType: "FoodEstablishment" });
    expect(business.openingHours).toEqual([{ day: 1, opens: "09:00", closes: "17:00" }]);
  });

  it("rejects branding images that don't exist", async () => {
    await signInAs("ADMIN");
    const res = await saveSettingsSection("branding", { ok: false }, formData({ logoText: "MC PREPS", logoMediaId: "missing-id" }));
    expect(res.ok).toBe(false);
  });

  it("rejects unsafe announcement links", async () => {
    await signInAs("ADMIN");
    const res = await saveSettingsSection("website", { ok: false }, formData({ announcementText: "Hello", announcementHref: "javascript:alert(1)" }));
    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.announcementHref).toBeTruthy();
  });

  it("sends a test email through the outbox", async () => {
    const admin = await signInAs("ADMIN");
    await updateSettingsGroup("contact", { orderNotificationEmails: ["orders@mcpreps.test"] }, admin.id);
    const sent: OutgoingEmail[] = [];
    const transport: EmailTransport = async (email) => {
      sent.push(email);
      return { provider: "fake", messageId: `fake-${email.id}` };
    };
    const res = await sendTestEmail(admin, { transport });
    expect(res.result.sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("orders@mcpreps.test");
    const row = await db.emailOutbox.findFirstOrThrow({ where: { type: "TEST" } });
    expect(row).toMatchObject({ status: "SENT", provider: "fake" });
  });

  it("explains when there is nobody to send a test email to", async () => {
    const admin = await signInAs("ADMIN");
    const res = await sendTestEmail(admin, { transport: async () => ({ provider: "fake", messageId: null }) });
    expect(res.errors).toContain("NO_RECIPIENTS");
    expect(await db.emailOutbox.count()).toBe(0);
  });
});
