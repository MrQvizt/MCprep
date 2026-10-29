/**
 * Field descriptors for the structured page-content editor. Client-safe:
 * used by the admin form renderer and by the server action for strict
 * validation (the stored schemas are lenient and fall back to defaults,
 * so we validate here first to give the owner clear error messages).
 */
import { CONTENT_KEYS, type ContentKey } from "@/lib/content/schema";
import { isSafeHref } from "@/lib/urls";

export const ICON_OPTIONS = [
  { value: "flame", label: "Flame (fresh / cooked)" },
  { value: "target", label: "Target (macros)" },
  { value: "dumbbell", label: "Dumbbell (training)" },
  { value: "truck", label: "Truck (delivery)" },
  { value: "message-circle", label: "Chat (personal service)" },
] as const;

const ICON_VALUES = new Set<string>(ICON_OPTIONS.map((o) => o.value));

interface Base {
  name: string;
  label: string;
  hint?: string;
}

export type ContentFieldDef =
  | (Base & { kind: "text"; max: number; required?: boolean })
  | (Base & { kind: "textarea"; max: number; rows?: number; required?: boolean })
  | (Base & { kind: "cta" })
  | (Base & { kind: "media"; category: string })
  | (Base & { kind: "boolean" })
  | (Base & { kind: "number"; min: number; max: number })
  | (Base & { kind: "items"; itemLabel: string; withIcon?: boolean; titleMax: number; bodyMax: number; maxItems: number })
  | (Base & { kind: "strings"; itemLabel: string; itemMax: number; maxItems: number })
  | (Base & { kind: "faqs"; maxItems: number })
  | (Base & { kind: "sections"; maxItems: number })
  | (Base & { kind: "html" });

const eyebrow = (): ContentFieldDef => ({ kind: "text", name: "eyebrow", label: "Small label above the heading", max: 60 });
const heading = (label = "Heading", max = 120): ContentFieldDef => ({ kind: "text", name: "heading", label, max, required: true });
const intro = (max = 1200, label = "Introduction"): ContentFieldDef => ({ kind: "textarea", name: "intro", label, max, rows: 3 });
const image = (name = "imageId", label = "Image", category = "HERO"): ContentFieldDef => ({ kind: "media", name, label, category });
const PARA_HINT = "Leave a blank line between paragraphs.";

const servicePage: ContentFieldDef[] = [
  { kind: "text", name: "eyebrow", label: "Small label above the heading", max: 80 },
  { kind: "text", name: "h1", label: "Main heading (H1)", max: 140, required: true, hint: "Describe the service and mention Malta naturally." },
  { kind: "textarea", name: "intro", label: "Introduction", max: 2000, rows: 4 },
  { kind: "sections", name: "sections", label: "Content sections", maxItems: 24, hint: "Each section has a sub-heading and text." },
  { kind: "faqs", name: "faqs", label: "Questions & answers", maxItems: 24 },
  { kind: "cta", name: "cta", label: "Call-to-action button" },
  image("imageId", "Image", "HERO"),
  { kind: "boolean", name: "showPlans", label: "Show the meal plans on this page" },
  { kind: "boolean", name: "showMeals", label: "Show featured meals on this page" },
];

const legalPage: ContentFieldDef[] = [
  { kind: "text", name: "title", label: "Page title", max: 120, required: true },
  { kind: "html", name: "html", label: "Page text", hint: "Replace every item in [square brackets] with your real details." },
  { kind: "text", name: "lastUpdated", label: "Last updated (shown on the page)", max: 40, hint: "Filled in automatically when you change the text." },
  { kind: "boolean", name: "reviewedByOwner", label: "I have reviewed this page (with a qualified adviser where needed)" },
];

export const CONTENT_FIELDS: Record<ContentKey, ContentFieldDef[]> = {
  "home.hero": [
    { kind: "text", name: "kicker", label: "Search-friendly line above the headline", max: 120, hint: "Part of the page's main heading for Google, e.g. “Macro-tracked meal prep in Malta”." },
    { kind: "text", name: "headline", label: "Big headline", max: 80, required: true },
    { kind: "textarea", name: "subheadline", label: "Subheadline", max: 300, rows: 2 },
    { kind: "cta", name: "primaryCta", label: "Main button" },
    { kind: "cta", name: "secondaryCta", label: "Second button" },
    image("imageId", "Hero photo", "HERO"),
    { kind: "text", name: "imageAlt", label: "Hero photo description (alt text)", max: 200 },
    { kind: "strings", name: "proofPoints", label: "Short proof points", itemLabel: "Proof point", itemMax: 60, maxItems: 6 },
  ],
  "home.intro": [heading(), { kind: "textarea", name: "body", label: "Text", max: 4000, rows: 8, hint: PARA_HINT }],
  "home.benefits": [
    eyebrow(),
    heading(),
    { kind: "items", name: "items", label: "Benefits", itemLabel: "Benefit", withIcon: true, titleMax: 120, bodyMax: 600, maxItems: 8 },
  ],
  "home.featuredMeals": [
    eyebrow(),
    heading(),
    { kind: "textarea", name: "subheading", label: "Subheading", max: 300, rows: 2 },
    { kind: "text", name: "ctaLabel", label: "Button text", max: 60 },
  ],
  "home.howItWorks": [
    eyebrow(),
    heading(),
    { kind: "items", name: "steps", label: "Steps", itemLabel: "Step", titleMax: 120, bodyMax: 600, maxItems: 6 },
    { kind: "textarea", name: "note", label: "Note under the steps", max: 300, rows: 2 },
  ],
  "home.fulfillment": [
    eyebrow(),
    heading(),
    { kind: "textarea", name: "body", label: "Text", max: 600, rows: 3 },
    { kind: "text", name: "collectionTitle", label: "Collection title", max: 60 },
    { kind: "textarea", name: "collectionBody", label: "Collection text", max: 600, rows: 3 },
    { kind: "text", name: "deliveryTitle", label: "Delivery title", max: 60 },
    { kind: "textarea", name: "deliveryBody", label: "Delivery text", max: 600, rows: 3 },
  ],
  "home.plans": [eyebrow(), heading(), { kind: "textarea", name: "subheading", label: "Subheading", max: 300, rows: 2 }],
  "home.instagram": [eyebrow(), heading(), { kind: "text", name: "ctaLabel", label: "Button text", max: 60 }],
  "home.testimonials": [eyebrow(), heading()],
  "home.faq": [eyebrow(), heading()],
  "home.finalCta": [
    { kind: "text", name: "headline", label: "Headline", max: 80, required: true },
    { kind: "textarea", name: "body", label: "Text", max: 300, rows: 2 },
    { kind: "cta", name: "cta", label: "Button" },
    image("imageId", "Background photo", "HERO"),
  ],
  "home.sections": [
    { kind: "boolean", name: "showBenefits", label: "Why MC PREPS" },
    { kind: "boolean", name: "showFeaturedMeals", label: "Featured meals" },
    { kind: "boolean", name: "showHowItWorks", label: "How it works" },
    { kind: "boolean", name: "showFulfillment", label: "Collection & delivery" },
    { kind: "boolean", name: "showPlans", label: "Meal plans & prices" },
    { kind: "boolean", name: "showPromotion", label: "Promotion banner (when an offer is live)" },
    { kind: "boolean", name: "showInstagram", label: "Instagram gallery" },
    { kind: "boolean", name: "showTestimonials", label: "Testimonials (only if published ones exist)" },
    { kind: "boolean", name: "showFaq", label: "FAQ" },
    { kind: "boolean", name: "showFinalCta", label: "Final call to action" },
    { kind: "number", name: "featuredMealLimit", label: "How many featured meals to show", min: 1, max: 12 },
    { kind: "number", name: "galleryLimit", label: "How many Instagram photos to show", min: 3, max: 12 },
  ],
  "page.about": [
    eyebrow(),
    heading(),
    intro(),
    { kind: "textarea", name: "body", label: "Story", max: 8000, rows: 10, hint: PARA_HINT },
    { kind: "items", name: "values", label: "What we stand for", itemLabel: "Value", titleMax: 120, bodyMax: 600, maxItems: 6 },
    image("imageId", "Photo", "HERO"),
    { kind: "textarea", name: "ownerNote", label: "Extra note (optional)", max: 1200, rows: 3 },
  ],
  "page.howItWorks": [
    eyebrow(),
    heading(),
    intro(),
    { kind: "items", name: "steps", label: "Steps", itemLabel: "Step", titleMax: 120, bodyMax: 600, maxItems: 8 },
    { kind: "textarea", name: "body", label: "Extra information", max: 4000, rows: 5, hint: PARA_HINT },
  ],
  "page.contact": [eyebrow(), heading(), intro()],
  "page.faq": [eyebrow(), heading(), intro(600)],
  "page.menu": [
    eyebrow(),
    heading(),
    intro(),
    { kind: "textarea", name: "nutritionNote", label: "Nutrition & allergen note", max: 1200, rows: 3 },
  ],
  "page.plans": [eyebrow(), heading(), intro(), { kind: "textarea", name: "note", label: "Note under the plans", max: 600, rows: 2 }],
  "page.gallery": [eyebrow(), heading(), intro(600)],
  "page.offers": [
    eyebrow(),
    heading(),
    intro(600),
    { kind: "textarea", name: "emptyMessage", label: "Message when no offer is running", max: 600, rows: 2 },
  ],
  "page.deliveryAreas": [
    eyebrow(),
    heading(),
    intro(2000),
    { kind: "textarea", name: "body", label: "Extra information", max: 6000, rows: 6, hint: PARA_HINT },
  ],
  "page.blog": [eyebrow(), heading(), intro(600)],
  "page.footer": [
    { kind: "textarea", name: "tagline", label: "Footer tagline", max: 300, rows: 2 },
    { kind: "textarea", name: "smallPrint", label: "Small print (optional)", max: 600, rows: 2 },
  ],
  "service.mealPrepMalta": servicePage,
  "service.healthyMealDeliveryMalta": servicePage,
  "service.mealPlansMalta": servicePage,
  "service.highProteinMealsMalta": servicePage,
  "legal.privacy": legalPage,
  "legal.terms": legalPage,
  "legal.cookies": legalPage,
};

export const CONTENT_VIEW_PATHS: Record<ContentKey, string> = {
  "home.hero": "/",
  "home.intro": "/",
  "home.benefits": "/",
  "home.featuredMeals": "/",
  "home.howItWorks": "/",
  "home.fulfillment": "/",
  "home.plans": "/",
  "home.instagram": "/",
  "home.testimonials": "/",
  "home.faq": "/",
  "home.finalCta": "/",
  "home.sections": "/",
  "page.about": "/about",
  "page.howItWorks": "/how-it-works",
  "page.contact": "/contact",
  "page.faq": "/faq",
  "page.menu": "/menu",
  "page.plans": "/plans",
  "page.gallery": "/gallery",
  "page.offers": "/offers",
  "page.deliveryAreas": "/delivery-areas",
  "page.blog": "/blog",
  "page.footer": "/",
  "service.mealPrepMalta": "/meal-prep-malta",
  "service.healthyMealDeliveryMalta": "/healthy-meal-delivery-malta",
  "service.mealPlansMalta": "/meal-plans-malta",
  "service.highProteinMealsMalta": "/high-protein-meals-malta",
  "legal.privacy": "/privacy-policy",
  "legal.terms": "/terms",
  "legal.cookies": "/cookie-policy",
};

export const CONTENT_GROUPS: { title: string; description: string; keys: ContentKey[] }[] = [
  {
    title: "Homepage",
    description: "Each section of the homepage, in the order visitors see them.",
    keys: CONTENT_KEYS.filter((k) => k.startsWith("home.")),
  },
  {
    title: "Pages",
    description: "Headings and text for the main website pages.",
    keys: CONTENT_KEYS.filter((k) => k.startsWith("page.") && k !== "page.footer"),
  },
  {
    title: "Google landing pages",
    description: "Service pages written for people searching for meal prep in Malta.",
    keys: CONTENT_KEYS.filter((k) => k.startsWith("service.")),
  },
  {
    title: "Legal",
    description: "Templates that must be reviewed by you and a qualified adviser before launch.",
    keys: CONTENT_KEYS.filter((k) => k.startsWith("legal.")),
  },
  { title: "Footer", description: "Text at the bottom of every page.", keys: ["page.footer"] },
];

export function isContentKey(value: string): value is ContentKey {
  return (CONTENT_KEYS as string[]).includes(value);
}

export function mediaFieldNames(key: ContentKey): string[] {
  return CONTENT_FIELDS[key].filter((f) => f.kind === "media").map((f) => f.name);
}

export function htmlFieldNames(key: ContentKey): string[] {
  return CONTENT_FIELDS[key].filter((f) => f.kind === "html").map((f) => f.name);
}

type Errors = Record<string, string>;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Strictly validate an edited content block against its field descriptors.
 * Returns the cleaned value (unknown keys dropped) or field errors keyed by
 * path (e.g. "primaryCta.href", "items.2.title").
 */
export function validateContentBlock(
  key: ContentKey,
  input: unknown,
): { ok: true; value: Record<string, unknown> } | { ok: false; errors: Errors } {
  const data = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const errors: Errors = {};
  const out: Record<string, unknown> = {};
  const tooLong = (label: string, max: number) => `${label} must be ${max} characters or fewer.`;

  for (const f of CONTENT_FIELDS[key]) {
    const raw = data[f.name];
    switch (f.kind) {
      case "text":
      case "textarea": {
        const v = str(raw).replace(/\r\n/g, "\n").trim();
        if (f.required && v === "") errors[f.name] = `${f.label} is required.`;
        else if (v.length > f.max) errors[f.name] = tooLong(f.label, f.max);
        out[f.name] = v;
        break;
      }
      case "html": {
        const v = str(raw);
        if (v.length > 60000) errors[f.name] = "The text is too long.";
        out[f.name] = v;
        break;
      }
      case "cta": {
        const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
        const label = str(o.label).trim();
        const href = str(o.href).trim();
        if (label === "") errors[`${f.name}.label`] = "Button text is required.";
        else if (label.length > 60) errors[`${f.name}.label`] = tooLong("Button text", 60);
        if (href === "") errors[`${f.name}.href`] = "Button link is required.";
        else if (!isSafeHref(href) || href.length > 300) {
          errors[`${f.name}.href`] = "Use a page on this site (e.g. /plans) or a full https:// link.";
        }
        out[f.name] = { label, href };
        break;
      }
      case "media": {
        const v = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
        out[f.name] = v;
        break;
      }
      case "boolean":
        out[f.name] = raw === true || raw === "true" || raw === "on";
        break;
      case "number": {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isInteger(n) || n < f.min || n > f.max) errors[f.name] = `${f.label} must be a whole number from ${f.min} to ${f.max}.`;
        out[f.name] = Number.isFinite(n) ? n : f.min;
        break;
      }
      case "strings": {
        const arr = Array.isArray(raw) ? raw.map((v) => str(v).trim()).filter(Boolean) : [];
        if (arr.length > f.maxItems) errors[f.name] = `Up to ${f.maxItems} items.`;
        arr.forEach((v, i) => {
          if (v.length > f.itemMax) errors[`${f.name}.${i}`] = tooLong(f.itemLabel, f.itemMax);
        });
        out[f.name] = arr;
        break;
      }
      case "items": {
        const arr = Array.isArray(raw) ? raw : [];
        if (arr.length > f.maxItems) errors[f.name] = `Up to ${f.maxItems} items.`;
        out[f.name] = arr.map((item, i) => {
          const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const title = str(o.title).trim();
          const body = str(o.body).trim();
          if (title === "") errors[`${f.name}.${i}.title`] = "Title is required.";
          else if (title.length > f.titleMax) errors[`${f.name}.${i}.title`] = tooLong("Title", f.titleMax);
          if (body.length > f.bodyMax) errors[`${f.name}.${i}.body`] = tooLong("Text", f.bodyMax);
          if (f.withIcon) {
            const icon = str(o.icon) || "flame";
            if (!ICON_VALUES.has(icon)) errors[`${f.name}.${i}.icon`] = "Choose an icon from the list.";
            return { title, body, icon };
          }
          return { title, body };
        });
        break;
      }
      case "faqs": {
        const arr = Array.isArray(raw) ? raw : [];
        if (arr.length > f.maxItems) errors[f.name] = `Up to ${f.maxItems} questions.`;
        out[f.name] = arr.map((item, i) => {
          const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const question = str(o.question).trim();
          const answer = str(o.answer).trim();
          if (question === "") errors[`${f.name}.${i}.question`] = "Question is required.";
          else if (question.length > 240) errors[`${f.name}.${i}.question`] = tooLong("Question", 240);
          if (answer === "") errors[`${f.name}.${i}.answer`] = "Answer is required.";
          else if (answer.length > 2000) errors[`${f.name}.${i}.answer`] = tooLong("Answer", 2000);
          return { question, answer };
        });
        break;
      }
      case "sections": {
        const arr = Array.isArray(raw) ? raw : [];
        if (arr.length > f.maxItems) errors[f.name] = `Up to ${f.maxItems} sections.`;
        out[f.name] = arr.map((item, i) => {
          const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const headingValue = str(o.heading).trim();
          const body = str(o.body).trim();
          if (headingValue === "") errors[`${f.name}.${i}.heading`] = "Sub-heading is required.";
          else if (headingValue.length > 160) errors[`${f.name}.${i}.heading`] = tooLong("Sub-heading", 160);
          if (body.length > 6000) errors[`${f.name}.${i}.body`] = tooLong("Text", 6000);
          return { heading: headingValue, body };
        });
        break;
      }
    }
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: out };
}
