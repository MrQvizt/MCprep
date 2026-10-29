/** Shared analytics event definitions (client + server). No personal data allowed. */

export const ANALYTICS_EVENTS = [
  "page_view",
  "view_meal",
  "view_pricing",
  "select_plan",
  "begin_order",
  "submit_order",
  "order_request_success",
  "click_whatsapp",
  "view_promotion",
  "select_promotion",
  "click_instagram",
  "click_phone",
  "click_email",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export interface AnalyticsParams {
  planSlug?: string;
  mealSlug?: string;
  promotionSlug?: string;
}

export const EVENT_LABELS: Record<AnalyticsEventName, string> = {
  page_view: "Page views",
  view_meal: "Meal views",
  view_pricing: "Pricing views",
  select_plan: "Plan selected",
  begin_order: "Order form started",
  submit_order: "Order form submitted",
  order_request_success: "Order requests received",
  click_whatsapp: "WhatsApp clicks",
  view_promotion: "Promotion views",
  select_promotion: "Promotion CTA clicks",
  click_instagram: "Instagram clicks",
  click_phone: "Phone clicks",
  click_email: "Email clicks",
};

export const CONSENT_COOKIE = "mcp_consent";
export const CONSENT_VERSION = 1;

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  v: number;
  t: number;
}

export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
    if (parsed.v !== CONSENT_VERSION) return null;
    return { analytics: Boolean(parsed.analytics), marketing: Boolean(parsed.marketing), v: CONSENT_VERSION, t: Number(parsed.t) || 0 };
  } catch {
    return null;
  }
}

export const ATTRIBUTION_STORAGE_KEY = "mcp_attr";

export interface Attribution {
  landingPath?: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  firstSeenAt?: string;
}
