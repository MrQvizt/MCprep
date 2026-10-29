/**
 * Strict form schemas for the Business settings screens. Each section is
 * validated here before being merged into its settings group (the stored
 * group schemas are lenient on purpose so the public site never breaks).
 */
import { z } from "zod";
import { fdBool, fdLines, fdString } from "@/lib/actions";
import { formatPhone, normalizePhone } from "@/lib/identity";
import { isInstagramUrl, isSafeHref, isSafeHttpUrl } from "@/lib/urls";

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const required = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Keep this under ${max} characters.`);
const email = (message = "Enter a valid email address, or leave it blank.") =>
  z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || z.email().safeParse(v).success, message);

/** Optional phone → stored in international format ("+356 7912 3456"). */
const phone = (label: string) =>
  z.string().transform((value, ctx) => {
    const v = value.trim();
    if (v === "") return "";
    const e164 = normalizePhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: `Enter a valid ${label}, e.g. 7912 3456 or +356 7912 3456.` });
      return z.NEVER;
    }
    return formatPhone(e164);
  });

const httpUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || isSafeHttpUrl(v), `Enter the full ${label} link starting with https://, or leave it blank.`);

// ── Business details ────────────────────────────────────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const openingHoursRowSchema = z
  .object({
    day: z.coerce.number().int().min(0).max(6),
    opens: z.string().regex(TIME_RE, "Use 24-hour time, e.g. 09:00."),
    closes: z.string().regex(TIME_RE, "Use 24-hour time, e.g. 17:30."),
  })
  .refine((h) => h.closes > h.opens, { message: "Closing time must be after opening time.", path: ["closes"] });

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const businessFormSchema = z
  .object({
    tradingName: required(80, "Enter your trading name."),
    registeredName: text(120),
    tagline: text(160),
    shortDescription: text(300),
    vatNumber: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => v.replace(/\s+/g, ""))
      .refine((v) => v === "" || /^(MT)?\d{8}$/.test(v), "Maltese VAT numbers look like MT12345678."),
    registrationNumber: text(40),
    addressLine1: text(120),
    addressLine2: text(120),
    addressLocality: text(80),
    addressPostalCode: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => v.replace(/^([A-Z]{3})\s*(\d{4})$/, "$1 $2"))
      .refine((v) => v === "" || /^[A-Z]{3} \d{4}$/.test(v), "Maltese postcodes look like SLM 1234."),
    showAddressPublicly: z.boolean(),
    businessType: z.enum(["LocalBusiness", "FoodEstablishment"]),
    openingHours: z.array(openingHoursRowSchema).max(21),
    openingHoursNote: text(300),
    areaServedText: text(160),
    foundingYear: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d{4}$/.test(v) && +v >= 1900 && +v <= new Date().getFullYear()), "Enter a year like 2023."),
    timeZone: z.string().trim().refine(isValidTimeZone, "Choose a valid time zone."),
    currency: z.literal("EUR"),
  })
  .superRefine((d, ctx) => {
    if (d.showAddressPublicly && !d.addressLine1 && !d.addressLocality) {
      ctx.addIssue({ code: "custom", path: ["showAddressPublicly"], message: "Add the address first, or keep it private." });
    }
  });

export function businessFormValues(fd: FormData) {
  const days = fd.getAll("hoursDay").map(String);
  const opens = fd.getAll("hoursOpens").map(String);
  const closes = fd.getAll("hoursCloses").map(String);
  const openingHours = days
    .map((day, i) => ({ day, opens: (opens[i] ?? "").trim(), closes: (closes[i] ?? "").trim() }))
    .filter((h) => h.opens !== "" || h.closes !== "");
  return {
    tradingName: fdString(fd, "tradingName"),
    registeredName: fdString(fd, "registeredName"),
    tagline: fdString(fd, "tagline"),
    shortDescription: fdString(fd, "shortDescription"),
    vatNumber: fdString(fd, "vatNumber"),
    registrationNumber: fdString(fd, "registrationNumber"),
    addressLine1: fdString(fd, "addressLine1"),
    addressLine2: fdString(fd, "addressLine2"),
    addressLocality: fdString(fd, "addressLocality"),
    addressPostalCode: fdString(fd, "addressPostalCode"),
    showAddressPublicly: fdBool(fd, "showAddressPublicly"),
    businessType: fdString(fd, "businessType") || "LocalBusiness",
    openingHours,
    openingHoursNote: fdString(fd, "openingHoursNote"),
    areaServedText: fdString(fd, "areaServedText"),
    foundingYear: fdString(fd, "foundingYear"),
    timeZone: fdString(fd, "timeZone") || "Europe/Malta",
    currency: fdString(fd, "currency") || "EUR",
  };
}

// ── Contact & social ────────────────────────────────────────────────────────

export const MESSAGE_PLACEHOLDERS = ["reference", "firstName", "plan"] as const;

const messageTemplate = (max: number, allowed: readonly string[]) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .superRefine((v, ctx) => {
      const unknown = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((t) => !allowed.includes(t));
      if (unknown.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown placeholder ${unknown.map((u) => `{${u}}`).join(", ")}. You can use ${allowed.map((a) => `{${a}}`).join(", ") || "no placeholders"}.`,
        });
      }
    });

export const contactFormSchema = z
  .object({
    publicEmail: email(),
    orderNotificationEmails: z
      .array(z.string().trim().toLowerCase())
      .max(5, "Use up to 5 notification addresses.")
      .superRefine((list, ctx) => {
        const bad = list.filter((e) => !z.email().safeParse(e).success);
        if (bad.length) ctx.addIssue({ code: "custom", message: `Not a valid email: ${bad.join(", ")}` });
      })
      .transform((list) => [...new Set(list)]),
    replyToEmail: email(),
    phone: phone("phone number"),
    whatsappNumber: phone("WhatsApp number"),
    whatsappEnabled: z.boolean(),
    whatsappDefaultMessage: messageTemplate(500, []),
    whatsappOrderMessage: messageTemplate(500, ["reference"]),
    whatsappFollowUpMessage: messageTemplate(600, MESSAGE_PLACEHOLDERS),
    instagramUrl: z
      .string()
      .trim()
      .max(300)
      .refine((v) => v === "" || isInstagramUrl(v), "Enter an instagram.com link, e.g. https://www.instagram.com/mcpreps.mt/"),
    instagramHandle: z
      .string()
      .trim()
      .transform((v) => v.replace(/^@/, ""))
      .refine((v) => v === "" || /^[a-zA-Z0-9._]{1,30}$/.test(v), "Instagram handles use letters, numbers, dots and underscores."),
    instagramDmEnabled: z.boolean(),
    facebookUrl: httpUrl("Facebook"),
    tiktokUrl: httpUrl("TikTok"),
    supportHours: text(200),
  });

export function contactFormValues(fd: FormData) {
  return {
    publicEmail: fdString(fd, "publicEmail"),
    orderNotificationEmails: fdString(fd, "orderNotificationEmails")
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean),
    replyToEmail: fdString(fd, "replyToEmail"),
    phone: fdString(fd, "phone"),
    whatsappNumber: fdString(fd, "whatsappNumber"),
    whatsappEnabled: fdBool(fd, "whatsappEnabled"),
    whatsappDefaultMessage: fdString(fd, "whatsappDefaultMessage"),
    whatsappOrderMessage: fdString(fd, "whatsappOrderMessage"),
    whatsappFollowUpMessage: fdString(fd, "whatsappFollowUpMessage"),
    instagramUrl: fdString(fd, "instagramUrl"),
    instagramHandle: fdString(fd, "instagramHandle"),
    instagramDmEnabled: fdBool(fd, "instagramDmEnabled"),
    facebookUrl: fdString(fd, "facebookUrl"),
    tiktokUrl: fdString(fd, "tiktokUrl"),
    supportHours: fdString(fd, "supportHours"),
  };
}

// ── Branding ────────────────────────────────────────────────────────────────

const mediaRef = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

export const brandingFormSchema = z.object({
  logoText: required(40, "Enter the text logo (shown until a logo image is uploaded)."),
  logoMediaId: mediaRef,
  logoAltMediaId: mediaRef,
  faviconMediaId: mediaRef,
  socialShareMediaId: mediaRef,
});

export function brandingFormValues(fd: FormData) {
  return {
    logoText: fdString(fd, "logoText"),
    logoMediaId: fdString(fd, "logoMediaId"),
    logoAltMediaId: fdString(fd, "logoAltMediaId"),
    faviconMediaId: fdString(fd, "faviconMediaId"),
    socialShareMediaId: fdString(fd, "socialShareMediaId"),
  };
}

// ── Order form ──────────────────────────────────────────────────────────────

export const orderFormFormSchema = z
  .object({
    askWhatsapp: z.boolean(),
    askStartDate: z.boolean(),
    askDietaryPreferences: z.boolean(),
    askAllergies: z.boolean(),
    askSpecialInstructions: z.boolean(),
    mealPreferenceOptions: z
      .array(z.string().trim().min(1).max(80, "Keep each option under 80 characters."))
      .max(12, "Use up to 12 options.")
      .transform((list) => [...new Set(list)]),
    sendCustomerConfirmation: z.boolean(),
    marketingOptInEnabled: z.boolean(),
    marketingConsentText: text(500),
    noPaymentNotice: required(600, "Keep a short notice explaining that no payment is taken online."),
    allergenNotice: required(1000, "Keep an allergen notice — it protects your customers and your business."),
  })
  .superRefine((d, ctx) => {
    if (d.marketingOptInEnabled && d.marketingConsentText.length < 20) {
      ctx.addIssue({
        code: "custom",
        path: ["marketingConsentText"],
        message: "Write the exact wording customers agree to (at least 20 characters), or switch the marketing checkbox off.",
      });
    }
  });

export function orderFormFormValues(fd: FormData) {
  return {
    askWhatsapp: fdBool(fd, "askWhatsapp"),
    askStartDate: fdBool(fd, "askStartDate"),
    askDietaryPreferences: fdBool(fd, "askDietaryPreferences"),
    askAllergies: fdBool(fd, "askAllergies"),
    askSpecialInstructions: fdBool(fd, "askSpecialInstructions"),
    mealPreferenceOptions: fdLines(fd, "mealPreferenceOptions"),
    sendCustomerConfirmation: fdBool(fd, "sendCustomerConfirmation"),
    marketingOptInEnabled: fdBool(fd, "marketingOptInEnabled"),
    marketingConsentText: fdString(fd, "marketingConsentText"),
    noPaymentNotice: fdString(fd, "noPaymentNotice"),
    allergenNotice: fdString(fd, "allergenNotice"),
  };
}

// ── Website ─────────────────────────────────────────────────────────────────

export const siteFormSchema = z
  .object({
    showDemoNotice: z.boolean(),
    demoNoticeText: text(200),
    announcementText: text(160),
    announcementHref: z
      .string()
      .trim()
      .max(300)
      .refine((v) => v === "" || isSafeHref(v), "Use a page address starting with / (e.g. /offers) or a full https:// link."),
  })
  .superRefine((d, ctx) => {
    if (d.showDemoNotice && d.demoNoticeText.length < 5) {
      ctx.addIssue({ code: "custom", path: ["demoNoticeText"], message: "Write the preview notice text, or switch the notice off." });
    }
    if (d.announcementHref && !d.announcementText) {
      ctx.addIssue({ code: "custom", path: ["announcementText"], message: "Add the announcement text for this link." });
    }
  });

export function siteFormValues(fd: FormData) {
  return {
    showDemoNotice: fdBool(fd, "showDemoNotice"),
    demoNoticeText: fdString(fd, "demoNoticeText"),
    announcementText: fdString(fd, "announcementText"),
    announcementHref: fdString(fd, "announcementHref"),
  };
}

// ── Tracking ────────────────────────────────────────────────────────────────

const trackingId = (re: RegExp, example: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || re.test(v), `That doesn't look right — it should look like ${example}.`);

export const trackingFormSchema = z.object({
  firstPartyAnalyticsEnabled: z.boolean(),
  consentBannerEnabled: z.boolean(),
  ga4MeasurementId: trackingId(/^G-[A-Z0-9]{4,}$/, "G-XXXXXXXXXX"),
  gtmContainerId: trackingId(/^GTM-[A-Z0-9]{4,}$/, "GTM-XXXXXXX"),
  metaPixelId: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{8,20}$/.test(v), "Meta Pixel IDs are a long number, e.g. 123456789012345."),
  googleAdsId: trackingId(/^AW-\d{6,}$/, "AW-123456789"),
  googleAdsConversionLabel: z
    .string()
    .trim()
    .max(100)
    .refine((v) => v === "" || /^[A-Za-z0-9_-]+$/.test(v), "Conversion labels use letters, numbers, - and _ only."),
});

export function trackingFormValues(fd: FormData) {
  return {
    firstPartyAnalyticsEnabled: fdBool(fd, "firstPartyAnalyticsEnabled"),
    consentBannerEnabled: fdBool(fd, "consentBannerEnabled"),
    ga4MeasurementId: fdString(fd, "ga4MeasurementId"),
    gtmContainerId: fdString(fd, "gtmContainerId"),
    metaPixelId: fdString(fd, "metaPixelId"),
    googleAdsId: fdString(fd, "googleAdsId"),
    googleAdsConversionLabel: fdString(fd, "googleAdsConversionLabel"),
  };
}

// ── SEO defaults ────────────────────────────────────────────────────────────

export const seoDefaultsFormSchema = z.object({
  titleSuffix: required(60, "Enter the text added to page titles, e.g. MC PREPS Malta."),
  defaultDescription: z
    .string()
    .trim()
    .min(50, "Write at least 50 characters — this is the fallback Google description.")
    .max(300, "Keep this under 300 characters (Google shows about 155)."),
});

export function seoDefaultsFormValues(fd: FormData) {
  return { titleSuffix: fdString(fd, "titleSuffix"), defaultDescription: fdString(fd, "defaultDescription") };
}

// ── Registry ────────────────────────────────────────────────────────────────

export const SETTINGS_SECTIONS = {
  business: { group: "business", label: "Business details", schema: businessFormSchema, values: businessFormValues },
  contact: { group: "contact", label: "Contact & social", schema: contactFormSchema, values: contactFormValues },
  branding: { group: "branding", label: "Logo & branding", schema: brandingFormSchema, values: brandingFormValues },
  "order-form": { group: "orderForm", label: "Order form", schema: orderFormFormSchema, values: orderFormFormValues },
  website: { group: "site", label: "Website notices", schema: siteFormSchema, values: siteFormValues },
  tracking: { group: "tracking", label: "Analytics & tracking", schema: trackingFormSchema, values: trackingFormValues },
  seo: { group: "seo", label: "Search defaults", schema: seoDefaultsFormSchema, values: seoDefaultsFormValues },
} as const;

export type SettingsSection = keyof typeof SETTINGS_SECTIONS;

export function isSettingsSection(value: string): value is SettingsSection {
  return value in SETTINGS_SECTIONS;
}
