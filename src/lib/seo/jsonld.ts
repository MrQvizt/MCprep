/**
 * JSON-LD builders. Only real, configured business data is emitted — no
 * invented addresses, ratings, reviews or opening hours.
 */
import type { AllSettings } from "@/lib/settings/schema";
import { WEEKDAYS } from "@/lib/time";

type Json = Record<string, unknown>;

export interface JsonLdContext {
  siteUrl: string;
  settings: AllSettings;
  logoUrl: string | null;
  imageUrl?: string | null;
}

function sameAs(settings: AllSettings): string[] {
  const c = settings.contact;
  return [c.instagramUrl, c.facebookUrl, c.tiktokUrl, c.googleBusinessProfileUrl].filter(
    (u): u is string => Boolean(u && /^https?:\/\//.test(u)),
  );
}

export function organizationJsonLd(ctx: JsonLdContext): Json {
  const b = ctx.settings.business;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${ctx.siteUrl}/#organization`,
    name: b.tradingName,
    ...(b.registeredName ? { legalName: b.registeredName } : {}),
    url: ctx.siteUrl,
    ...(ctx.logoUrl ? { logo: ctx.logoUrl } : {}),
    ...(sameAs(ctx.settings).length ? { sameAs: sameAs(ctx.settings) } : {}),
  };
}

export function websiteJsonLd(ctx: JsonLdContext): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${ctx.siteUrl}/#website`,
    name: ctx.settings.business.tradingName,
    url: ctx.siteUrl,
    inLanguage: "en-MT",
    publisher: { "@id": `${ctx.siteUrl}/#organization` },
  };
}

export interface ServedArea {
  name: string;
}

export interface CatalogPlan {
  name: string;
  description: string | null;
  priceCents: number | null;
  slug: string;
}

export function localBusinessJsonLd(
  ctx: JsonLdContext & { areas: ServedArea[]; plans?: CatalogPlan[]; currency: string },
): Json {
  const b = ctx.settings.business;
  const c = ctx.settings.contact;
  const hasAddress = b.showAddressPublicly && (b.addressLine1 || b.addressLocality);
  const hours = b.openingHours.map((h) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: `https://schema.org/${WEEKDAYS[h.day]}`,
    opens: h.opens,
    closes: h.closes,
  }));
  const areaServed =
    ctx.areas.length > 0
      ? ctx.areas.map((a) => ({ "@type": "Place", name: `${a.name}, Malta` }))
      : b.areaServedText
        ? [{ "@type": "Place", name: b.areaServedText }]
        : undefined;
  const offers = (ctx.plans ?? [])
    .filter((p) => p.priceCents !== null)
    .map((p) => ({
      "@type": "Offer",
      name: p.name,
      ...(p.description ? { description: p.description } : {}),
      price: (p.priceCents! / 100).toFixed(2),
      priceCurrency: ctx.currency,
      url: `${ctx.siteUrl}/order?plan=${encodeURIComponent(p.slug)}`,
    }));

  return {
    "@context": "https://schema.org",
    "@type": b.businessType,
    "@id": `${ctx.siteUrl}/#business`,
    name: b.tradingName,
    description: b.shortDescription,
    url: ctx.siteUrl,
    ...(ctx.logoUrl ? { logo: ctx.logoUrl } : {}),
    ...(ctx.imageUrl || ctx.logoUrl ? { image: ctx.imageUrl || ctx.logoUrl } : {}),
    ...(c.phone ? { telephone: c.phone } : {}),
    ...(c.publicEmail ? { email: c.publicEmail } : {}),
    ...(hasAddress
      ? {
          address: {
            "@type": "PostalAddress",
            ...(b.addressLine1 ? { streetAddress: [b.addressLine1, b.addressLine2].filter(Boolean).join(", ") } : {}),
            ...(b.addressLocality ? { addressLocality: b.addressLocality } : {}),
            ...(b.addressPostalCode ? { postalCode: b.addressPostalCode } : {}),
            addressCountry: "MT",
          },
        }
      : {}),
    ...(areaServed ? { areaServed } : {}),
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    ...(sameAs(ctx.settings).length ? { sameAs: sameAs(ctx.settings) } : {}),
    ...(offers.length
      ? { hasOfferCatalog: { "@type": "OfferCatalog", name: "Meal plans", itemListElement: offers } }
      : {}),
    parentOrganization: { "@id": `${ctx.siteUrl}/#organization` },
  };
}

export function breadcrumbJsonLd(siteUrl: string, items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteUrl}${item.path === "/" ? "" : item.path}` || siteUrl,
    })),
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]): Json | null {
  if (faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function blogPostingJsonLd(
  ctx: JsonLdContext,
  post: {
    title: string;
    description: string | null;
    path: string;
    imageUrl: string | null;
    publishedAt: Date;
    modifiedAt: Date;
    authorName: string | null;
    authorUrl: string | null;
  },
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title.slice(0, 110),
    ...(post.description ? { description: post.description } : {}),
    ...(post.imageUrl ? { image: [post.imageUrl] } : {}),
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.modifiedAt.toISOString(),
    mainEntityOfPage: { "@type": "WebPage", "@id": `${ctx.siteUrl}${post.path}` },
    author: post.authorName
      ? { "@type": "Person", name: post.authorName, ...(post.authorUrl ? { url: post.authorUrl } : {}) }
      : { "@type": "Organization", name: ctx.settings.business.tradingName, url: ctx.siteUrl },
    publisher: {
      "@type": "Organization",
      name: ctx.settings.business.tradingName,
      ...(ctx.logoUrl ? { logo: { "@type": "ImageObject", url: ctx.logoUrl } } : {}),
    },
    inLanguage: "en-MT",
  };
}

/** Serialise JSON-LD safely for a <script> tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
