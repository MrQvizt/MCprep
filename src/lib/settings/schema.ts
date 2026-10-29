import { z } from "zod";

/**
 * Typed settings groups stored in the SiteSetting table (key = group name).
 * Every field has a safe default so the site works before configuration.
 * IMPORTANT: no invented business facts — unknown details default to empty.
 */

const str = (def = "") => z.string().trim().max(2000).catch(def).default(def);
const bool = (def: boolean) => z.boolean().catch(def).default(def);
const mediaId = () => z.string().nullable().catch(null).default(null);

export const openingHoursSchema = z.object({
  day: z.number().int().min(0).max(6),
  opens: z.string().regex(/^\d{2}:\d{2}$/),
  closes: z.string().regex(/^\d{2}:\d{2}$/),
});

export const businessSettingsSchema = z.object({
  tradingName: str("MC PREPS"),
  registeredName: str(""),
  tagline: str("Meal prep for serious lifters."),
  shortDescription: str(
    "Fresh, macro-tracked, high-protein meal prep in Malta for lifters, active people and busy professionals.",
  ),
  country: str("MT"),
  locale: str("en-MT"),
  currency: str("EUR"),
  timeZone: str("Europe/Malta"),
  vatNumber: str(""),
  registrationNumber: str(""),
  addressLine1: str(""),
  addressLine2: str(""),
  addressLocality: str(""),
  addressPostalCode: str(""),
  showAddressPublicly: bool(false),
  businessType: z.enum(["LocalBusiness", "FoodEstablishment"]).catch("LocalBusiness").default("LocalBusiness"),
  openingHours: z.array(openingHoursSchema).catch([]).default([]),
  openingHoursNote: str(""),
  areaServedText: str("Malta"),
  foundingYear: str(""),
});

export const contactSettingsSchema = z.object({
  publicEmail: str(""),
  orderNotificationEmails: z.array(z.string().email()).catch([]).default([]),
  replyToEmail: str(""),
  phone: str(""),
  whatsappNumber: str(""),
  whatsappEnabled: bool(true),
  whatsappDefaultMessage: str(
    "Hi! I'm interested in your MC PREPS meal plans. Could you please send me more information?",
  ),
  whatsappOrderMessage: str("Hi MC PREPS! I've just submitted order {reference}. Looking forward to hearing from you."),
  whatsappFollowUpMessage: str(
    "Hi {firstName}, this is MC PREPS about your order request {reference} ({plan}). We'd love to confirm the details with you.",
  ),
  instagramUrl: str("https://www.instagram.com/mcpreps.mt/"),
  instagramHandle: str("mcpreps.mt"),
  instagramDmEnabled: bool(true),
  facebookUrl: str(""),
  tiktokUrl: str(""),
  googleBusinessProfileUrl: str(""),
  googleReviewUrl: str(""),
  supportHours: str(""),
});

export const brandingSettingsSchema = z.object({
  logoText: str("MC PREPS"),
  logoMediaId: mediaId(),
  logoAltMediaId: mediaId(),
  faviconMediaId: mediaId(),
  socialShareMediaId: mediaId(),
});

export const seoSettingsSchema = z.object({
  titleSuffix: str("MC PREPS Malta"),
  defaultDescription: str(
    "Discover MC PREPS Malta. Explore fresh, macro-tracked, high-protein meals designed for active lifestyles. Collection and delivery options available.",
  ),
  googleSiteVerification: str(""),
  bingSiteVerification: str(""),
  searchConsolePropertyUrl: str(""),
  searchConsoleConnectedNote: str(""),
});

export const trackingSettingsSchema = z.object({
  consentBannerEnabled: bool(true),
  firstPartyAnalyticsEnabled: bool(true),
  ga4MeasurementId: z.string().trim().regex(/^(G-[A-Z0-9]+)?$/).catch("").default(""),
  gtmContainerId: z.string().trim().regex(/^(GTM-[A-Z0-9]+)?$/).catch("").default(""),
  metaPixelId: z.string().trim().regex(/^(\d+)?$/).catch("").default(""),
  googleAdsId: z.string().trim().regex(/^(AW-\d+)?$/).catch("").default(""),
  googleAdsConversionLabel: str(""),
});

export const fulfillmentSettingsSchema = z.object({
  deliveryEnabled: bool(true),
  collectionEnabled: bool(true),
  deliveryInfo: str(""),
  collectionInfo: str(""),
  noDeliveryAreasMessage: str(
    "We're finalising our delivery localities. Message us on WhatsApp or Instagram to check delivery to your area, or choose collection.",
  ),
  leadTimeDays: z.number().int().min(0).max(60).catch(1).default(1),
  gozoNote: str(""),
});

export const orderFormSettingsSchema = z.object({
  askWhatsapp: bool(true),
  askStartDate: bool(true),
  askDietaryPreferences: bool(true),
  askAllergies: bool(true),
  askSpecialInstructions: bool(true),
  mealPreferenceOptions: z.array(z.string().trim().min(1).max(80)).catch([]).default([]),
  sendCustomerConfirmation: bool(true),
  marketingOptInEnabled: bool(true),
  marketingConsentText: str(
    "Yes, I'd like to receive occasional emails from MC PREPS about new meals and offers. I can unsubscribe at any time.",
  ),
  noPaymentNotice: str(
    "No payment is required now. Once you submit your order, our team will contact you to confirm availability, delivery details, and payment arrangements.",
  ),
  allergenNotice: str(
    "If you have an allergy or intolerance, tell us below and we'll confirm what's suitable before your order is confirmed. Allergy details are kept private and used only to prepare your order safely.",
  ),
});

export const siteSettingsSchema = z.object({
  showDemoNotice: bool(true),
  demoNoticeText: str("Preview site — sample content and placeholder prices are still being finalised."),
  announcementText: str(""),
  announcementHref: str(""),
});

export const SETTINGS_SCHEMAS = {
  business: businessSettingsSchema,
  contact: contactSettingsSchema,
  branding: brandingSettingsSchema,
  seo: seoSettingsSchema,
  tracking: trackingSettingsSchema,
  fulfillment: fulfillmentSettingsSchema,
  orderForm: orderFormSettingsSchema,
  site: siteSettingsSchema,
} as const;

export type SettingsGroup = keyof typeof SETTINGS_SCHEMAS;
export type SettingsOf<G extends SettingsGroup> = z.infer<(typeof SETTINGS_SCHEMAS)[G]>;
export type AllSettings = { [G in SettingsGroup]: SettingsOf<G> };

export const SETTINGS_GROUPS = Object.keys(SETTINGS_SCHEMAS) as SettingsGroup[];

export function parseSettings<G extends SettingsGroup>(group: G, value: unknown): SettingsOf<G> {
  const schema = SETTINGS_SCHEMAS[group];
  const raw = value && typeof value === "object" ? value : {};
  return schema.parse(raw) as SettingsOf<G>;
}

export function defaultSettings<G extends SettingsGroup>(group: G): SettingsOf<G> {
  return parseSettings(group, {});
}
