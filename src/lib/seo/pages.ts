/**
 * Registry of fixed public pages. Used for metadata defaults, the sitemap, the
 * admin SEO dashboard and the SEO quality assistant. Client-safe.
 */

export interface StaticPageDef {
  key: string;
  path: string;
  label: string;
  defaultTitle: string;
  defaultDescription: string;
  primaryTopic: string;
  breadcrumb: string;
  /** Default indexing (admin can override per page). */
  indexable: boolean;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  /** Structured data types this page is expected to output. */
  schema: string[];
  /** Page-content key holding the page's main heading (for SEO checks). */
  contentKey?: string;
  group: "core" | "service" | "content" | "legal" | "conversion";
}

export const STATIC_PAGES = [
  {
    key: "home",
    path: "/",
    label: "Homepage",
    defaultTitle: "MC PREPS Malta | Macro-Tracked Meal Prep & High-Protein Meals",
    defaultDescription:
      "Discover MC PREPS Malta. Explore fresh, macro-tracked, high-protein meals designed for active lifestyles. Collection and delivery options available.",
    primaryTopic: "MC Preps Malta / meal prep Malta",
    breadcrumb: "Home",
    indexable: true,
    priority: 1,
    changeFrequency: "weekly",
    schema: ["Organization", "LocalBusiness", "WebSite"],
    contentKey: "home.hero",
    group: "core",
  },
  {
    key: "menu",
    path: "/menu",
    label: "Menu",
    defaultTitle: "Menu | Macro-Tracked High-Protein Meals | MC PREPS Malta",
    defaultDescription:
      "Browse the MC PREPS menu: fresh, high-protein meals with calories and macros listed. Meal prep cooked weekly in Malta.",
    primaryTopic: "macro tracked meals Malta",
    breadcrumb: "Menu",
    indexable: true,
    priority: 0.9,
    changeFrequency: "weekly",
    schema: ["BreadcrumbList"],
    contentKey: "page.menu",
    group: "core",
  },
  {
    key: "plans",
    path: "/plans",
    label: "Plans & Pricing",
    defaultTitle: "Meal Plans & Prices | 1 Week, 2 Weeks or 1 Month | MC PREPS Malta",
    defaultDescription:
      "Compare MC PREPS meal plans in Malta — 1 week, 2 weeks or 1 month. Choose a plan, send your order request and we'll confirm the details with you.",
    primaryTopic: "meal plans Malta",
    breadcrumb: "Plans & Pricing",
    indexable: true,
    priority: 0.9,
    changeFrequency: "weekly",
    schema: ["BreadcrumbList"],
    contentKey: "page.plans",
    group: "core",
  },
  {
    key: "how-it-works",
    path: "/how-it-works",
    label: "How It Works",
    defaultTitle: "How It Works | Ordering Meal Prep in Malta | MC PREPS",
    defaultDescription:
      "How ordering from MC PREPS works: choose a plan, send an order request and our team contacts you to confirm collection or delivery and payment.",
    primaryTopic: "how meal prep ordering works",
    breadcrumb: "How It Works",
    indexable: true,
    priority: 0.6,
    changeFrequency: "monthly",
    schema: ["BreadcrumbList"],
    contentKey: "page.howItWorks",
    group: "core",
  },
  {
    key: "about",
    path: "/about",
    label: "About Us",
    defaultTitle: "About MC PREPS | Meal Prep for Serious Lifters in Malta",
    defaultDescription:
      "MC PREPS is a Malta-based meal prep brand cooking high-protein, macro-counted meals fresh every week for lifters and busy people.",
    primaryTopic: "MC Preps",
    breadcrumb: "About",
    indexable: true,
    priority: 0.6,
    changeFrequency: "monthly",
    schema: ["BreadcrumbList"],
    contentKey: "page.about",
    group: "core",
  },
  {
    key: "faq",
    path: "/faq",
    label: "FAQ",
    defaultTitle: "FAQ | Meal Prep Orders, Delivery & Allergies | MC PREPS Malta",
    defaultDescription:
      "Answers to common questions about MC PREPS meal plans, ordering, collection, delivery in Malta, allergies and payment.",
    primaryTopic: "meal prep questions",
    breadcrumb: "FAQ",
    indexable: true,
    priority: 0.6,
    changeFrequency: "monthly",
    schema: ["BreadcrumbList"],
    contentKey: "page.faq",
    group: "core",
  },
  {
    key: "contact",
    path: "/contact",
    label: "Contact",
    defaultTitle: "Contact MC PREPS | WhatsApp, Instagram & Email | Malta",
    defaultDescription:
      "Get in touch with MC PREPS about meal plans, allergies, collection or delivery in Malta via WhatsApp, Instagram or email.",
    primaryTopic: "contact MC Preps",
    breadcrumb: "Contact",
    indexable: true,
    priority: 0.5,
    changeFrequency: "monthly",
    schema: ["BreadcrumbList", "LocalBusiness"],
    contentKey: "page.contact",
    group: "core",
  },
  {
    key: "gallery",
    path: "/gallery",
    label: "Gallery",
    defaultTitle: "Gallery | Fresh Meal Prep from the MC PREPS Kitchen",
    defaultDescription: "Photos of MC PREPS meals and meal prep in Malta, straight from our Instagram.",
    primaryTopic: "MC Preps photos",
    breadcrumb: "Gallery",
    indexable: true,
    priority: 0.4,
    changeFrequency: "weekly",
    schema: ["BreadcrumbList"],
    contentKey: "page.gallery",
    group: "content",
  },
  {
    key: "offers",
    path: "/offers",
    label: "Offers",
    defaultTitle: "Current Offers | MC PREPS Malta Meal Plans",
    defaultDescription: "Genuine, time-limited offers on MC PREPS meal plans in Malta, with real end dates.",
    primaryTopic: "meal prep offers Malta",
    breadcrumb: "Offers",
    indexable: true,
    priority: 0.5,
    changeFrequency: "weekly",
    schema: ["BreadcrumbList"],
    contentKey: "page.offers",
    group: "conversion",
  },
  {
    key: "meal-prep-malta",
    path: "/meal-prep-malta",
    label: "Meal Prep Malta",
    defaultTitle: "Meal Prep Malta | Fresh Weekly Meal Prep | MC PREPS",
    defaultDescription:
      "Meal prep in Malta cooked fresh every week. High-protein, macro-counted meals with collection or delivery. Choose a plan and request your order online.",
    primaryTopic: "meal prep Malta",
    breadcrumb: "Meal Prep Malta",
    indexable: true,
    priority: 0.9,
    changeFrequency: "monthly",
    schema: ["BreadcrumbList", "FAQPage"],
    contentKey: "service.mealPrepMalta",
    group: "service",
  },
  {
    key: "healthy-meal-delivery-malta",
    path: "/healthy-meal-delivery-malta",
    label: "Healthy Meal Delivery Malta",
    defaultTitle: "Healthy Meal Delivery Malta | Delivery & Collection | MC PREPS",
    defaultDescription:
      "Healthy, macro-counted meals delivered to supported localities in Malta, or ready for collection. See delivery areas, days and how ordering works.",
    primaryTopic: "healthy meal delivery Malta",
    breadcrumb: "Healthy Meal Delivery",
    indexable: true,
    priority: 0.8,
    changeFrequency: "monthly",
    schema: ["BreadcrumbList", "FAQPage"],
    contentKey: "service.healthyMealDeliveryMalta",
    group: "service",
  },
  {
    key: "meal-plans-malta",
    path: "/meal-plans-malta",
    label: "Meal Plans Malta",
    defaultTitle: "Meal Plans Malta | Which Plan Is Right for You? | MC PREPS",
    defaultDescription:
      "Compare 1-week, 2-week and 1-month meal plans from MC PREPS in Malta and find the one that fits your training and schedule.",
    primaryTopic: "meal plans Malta",
    breadcrumb: "Meal Plans Malta",
    indexable: true,
    priority: 0.8,
    changeFrequency: "monthly",
    schema: ["BreadcrumbList", "FAQPage"],
    contentKey: "service.mealPlansMalta",
    group: "service",
  },
  {
    key: "high-protein-meals-malta",
    path: "/high-protein-meals-malta",
    label: "High-Protein Meals Malta",
    defaultTitle: "High-Protein Meals Malta | Macro-Counted Meal Prep | MC PREPS",
    defaultDescription:
      "High-protein, macro-counted meals in Malta for powerlifters, bodybuilders and active people. Calories and macros listed for every meal on the menu.",
    primaryTopic: "high protein meal prep Malta",
    breadcrumb: "High-Protein Meals",
    indexable: true,
    priority: 0.8,
    changeFrequency: "monthly",
    schema: ["BreadcrumbList", "FAQPage"],
    contentKey: "service.highProteinMealsMalta",
    group: "service",
  },
  {
    key: "delivery-areas",
    path: "/delivery-areas",
    label: "Delivery Areas",
    defaultTitle: "Delivery Areas | Meal Prep Delivery in Malta | MC PREPS",
    defaultDescription:
      "See where MC PREPS delivers in Malta, delivery days and any fees — or choose collection.",
    primaryTopic: "meal prep delivery Malta",
    breadcrumb: "Delivery Areas",
    indexable: true,
    priority: 0.7,
    changeFrequency: "monthly",
    schema: ["BreadcrumbList"],
    contentKey: "page.deliveryAreas",
    group: "service",
  },
  {
    key: "blog",
    path: "/blog",
    label: "Blog",
    defaultTitle: "Meal Prep & Nutrition Blog | MC PREPS Malta",
    defaultDescription: "Practical guides on meal prep, macros and eating well in Malta from MC PREPS.",
    primaryTopic: "meal prep tips Malta",
    breadcrumb: "Blog",
    indexable: true,
    priority: 0.6,
    changeFrequency: "weekly",
    schema: ["BreadcrumbList"],
    contentKey: "page.blog",
    group: "content",
  },
  {
    key: "order",
    path: "/order",
    label: "Order form",
    defaultTitle: "Request Your Meal Plan | MC PREPS Malta",
    defaultDescription: "Send your MC PREPS meal plan order request. No payment is taken online.",
    primaryTopic: "order meal prep Malta",
    breadcrumb: "Order",
    indexable: false,
    priority: 0.3,
    changeFrequency: "monthly",
    schema: ["BreadcrumbList"],
    group: "conversion",
  },
  {
    key: "privacy-policy",
    path: "/privacy-policy",
    label: "Privacy Policy",
    defaultTitle: "Privacy Policy | MC PREPS Malta",
    defaultDescription: "How MC PREPS collects, uses and protects your personal data.",
    primaryTopic: "privacy policy",
    breadcrumb: "Privacy Policy",
    indexable: true,
    priority: 0.2,
    changeFrequency: "yearly",
    schema: [],
    contentKey: "legal.privacy",
    group: "legal",
  },
  {
    key: "terms",
    path: "/terms",
    label: "Terms & Conditions",
    defaultTitle: "Terms & Conditions | MC PREPS Malta",
    defaultDescription: "Terms and conditions for MC PREPS meal plan order requests.",
    primaryTopic: "terms and conditions",
    breadcrumb: "Terms",
    indexable: true,
    priority: 0.2,
    changeFrequency: "yearly",
    schema: [],
    contentKey: "legal.terms",
    group: "legal",
  },
  {
    key: "cookie-policy",
    path: "/cookie-policy",
    label: "Cookie Policy",
    defaultTitle: "Cookie Policy | MC PREPS Malta",
    defaultDescription: "How MC PREPS uses cookies and similar technologies.",
    primaryTopic: "cookie policy",
    breadcrumb: "Cookie Policy",
    indexable: true,
    priority: 0.2,
    changeFrequency: "yearly",
    schema: [],
    contentKey: "legal.cookies",
    group: "legal",
  },
] as const satisfies readonly StaticPageDef[];

export type StaticPageKey = (typeof STATIC_PAGES)[number]["key"];

export function getStaticPage(key: StaticPageKey): StaticPageDef {
  const page = STATIC_PAGES.find((p) => p.key === key);
  if (!page) throw new Error(`Unknown page key ${key}`);
  return page;
}

/** Paths that are reserved by the app (cannot be used as redirect sources). */
export const RESERVED_PATH_PREFIXES = ["/admin", "/api", "/_next", "/media"];

export const TITLE_RECOMMENDED_MAX = 60;
export const DESCRIPTION_RECOMMENDED_MIN = 70;
export const DESCRIPTION_RECOMMENDED_MAX = 160;
