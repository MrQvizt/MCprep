import "server-only";
import type { Metadata } from "next";
import { cache } from "react";
import { db } from "@/lib/db";
import { absoluteUrl, indexingAllowed } from "@/lib/env";
import { getMedia } from "@/lib/media";
import { getSettings } from "@/lib/settings";
import { getStaticPage, type StaticPageKey } from "./pages";

export interface MetaInput {
  title: string;
  description?: string | null;
  path: string;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: { url: string; width?: number | null; height?: number | null; alt?: string | null } | null;
  noindex?: boolean;
  canonical?: string | null;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
}

const getSeoOverrides = cache(async () => {
  try {
    const rows = await db.sEOPageMetadata.findMany({ include: { ogImage: true } });
    return new Map(rows.map((r) => [r.pageKey, r]));
  } catch {
    return new Map();
  }
});

/** Default social share image: configured upload, else the generated brand card. */
export const getDefaultShareImage = cache(async () => {
  const settings = await getSettings();
  const media = await getMedia(settings.branding.socialShareMediaId);
  if (media) return { url: absoluteUrl(media.url), width: media.width, height: media.height, alt: media.altText };
  return { url: absoluteUrl("/og"), width: 1200, height: 630, alt: settings.business.tradingName };
});

export async function buildMetadata(input: MetaInput): Promise<Metadata> {
  const settings = await getSettings();
  const siteName = settings.business.tradingName;
  const image = input.ogImage ?? (await getDefaultShareImage());
  const imageUrl = absoluteUrl(image.url);
  const canonical = absoluteUrl(input.canonical || input.path);
  const index = !input.noindex && indexingAllowed();
  const description = input.description ?? settings.seo.defaultDescription;
  return {
    title: { absolute: input.title },
    description,
    alternates: { canonical },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: input.type ?? "website",
      siteName,
      locale: "en_MT",
      url: canonical,
      title: input.ogTitle || input.title,
      description: input.ogDescription || description,
      images: [{ url: imageUrl, width: image.width ?? undefined, height: image.height ?? undefined, alt: image.alt ?? siteName }],
      ...(input.type === "article"
        ? { publishedTime: input.publishedTime, modifiedTime: input.modifiedTime }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.ogTitle || input.title,
      description: input.ogDescription || description,
      images: [imageUrl],
    },
  };
}

/** Effective SEO values for a fixed page (defaults merged with admin overrides). */
export async function getPageSeo(key: StaticPageKey) {
  const def = getStaticPage(key);
  const overrides = await getSeoOverrides();
  const o = overrides.get(key);
  return {
    def,
    title: o?.title?.trim() || def.defaultTitle,
    description: o?.description?.trim() || def.defaultDescription,
    ogTitle: o?.ogTitle?.trim() || null,
    ogDescription: o?.ogDescription?.trim() || null,
    ogImage: o?.ogImage
      ? { url: o.ogImage.url, width: o.ogImage.width, height: o.ogImage.height, alt: o.ogImage.altText }
      : null,
    noindex: o ? o.noindex : !def.indexable,
    canonical: o?.canonicalUrl?.trim() || null,
    breadcrumb: o?.breadcrumbLabel?.trim() || def.breadcrumb,
  };
}

export async function staticPageMetadata(key: StaticPageKey): Promise<Metadata> {
  const seo = await getPageSeo(key);
  return buildMetadata({
    title: seo.title,
    description: seo.description,
    path: seo.def.path,
    ogTitle: seo.ogTitle,
    ogDescription: seo.ogDescription,
    ogImage: seo.ogImage,
    noindex: seo.noindex,
    canonical: seo.canonical,
  });
}
