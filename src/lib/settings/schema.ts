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

const milestoneSchema = z.object({
  days: z.number().int().min(2).max(365),
  points: z.number().int().min(1).max(10_000),
});

const rewardSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).default(""),
  points: z.number().int().min(1).max(100_000),
  /** Percentage off the next order; null = an item the team adds to the next order. */
  percentOff: z.number().int().min(1).max(100).nullable().default(null),
});

export type LoyaltyReward = z.infer<typeof rewardSchema>;
export type LoyaltyMilestone = z.infer<typeof milestoneSchema>;

/**
 * Daily streak scheme: customers with an account check in once a day (Malta
 * calendar) to earn points, with bonuses at streak milestones; points are
 * swapped for rewards that are honoured on their next order.
 */
export const loyaltySettingsSchema = z.object({
  enabled: bool(true),
  pointsPerCheckIn: z.number().int().min(1).max(1000).catch(10).default(10),
  milestones: z
    .array(milestoneSchema)
    .max(12)
    .catch([])
    .default([
      { days: 3, points: 20 },
      { days: 7, points: 50 },
      { days: 14, points: 100 },
      { days: 30, points: 300 },
    ]),
  rewards: z
    .array(rewardSchema)
    .max(12)
    .catch([])
    .default([
      {
        key: "protein-dessert",
        name: "Free protein dessert",
        description: "A protein dessert from the current menu, added to your next order.",
        points: 250,
        percentOff: null,
      },
      {
        key: "free-meal",
        name: "A free meal",
        description: "One extra meal of your choice in your next order.",
        points: 450,
        percentOff: null,
      },
      {
        key: "ten-percent-off",
        name: "10% off your next order",
        description: "Taken off your next package price.",
        points: 700,
        percentOff: 10,
      },
    ]),
  /** Rewards can be redeemed only after the customer's first confirmed order (stops points farming). */
  redeemRequiresConfirmedOrder: bool(true),
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
  loyalty: loyaltySettingsSchema,
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
