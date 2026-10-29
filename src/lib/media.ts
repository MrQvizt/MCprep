import "server-only";
import { db } from "@/lib/db";
import { buildStorageKey, processImageUpload } from "@/lib/images";
import { storage } from "@/lib/storage";
import type { MediaCategory } from "@/generated/prisma/client";

export interface MediaRef {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  altText: string | null;
}

export const MEDIA_SELECT = { id: true, url: true, width: true, height: true, altText: true } as const;

export async function createMediaAsset(opts: {
  file: { name: string; buffer: Buffer };
  category: MediaCategory;
  altText?: string | null;
  caption?: string | null;
  uploadedById?: string | null;
  isPlaceholder?: boolean;
}) {
  const keepPng = opts.category === "BRANDING";
  const processed = await processImageUpload(opts.file.buffer, { keepPng });
  const key = buildStorageKey(opts.category, opts.file.name, processed.extension);
  const stored = await storage().put(key, processed.buffer, processed.mimeType);
  try {
    return await db.mediaAsset.create({
      data: {
        storageKey: stored.key,
        url: stored.url,
        filename: opts.file.name.slice(0, 200),
        mimeType: processed.mimeType,
        sizeBytes: processed.buffer.byteLength,
        width: processed.width,
        height: processed.height,
        altText: opts.altText?.trim() || null,
        caption: opts.caption?.trim() || null,
        category: opts.category,
        uploadedById: opts.uploadedById ?? null,
        isPlaceholder: opts.isPlaceholder ?? false,
      },
    });
  } catch (error) {
    await storage().delete(stored.key).catch(() => undefined);
    throw error;
  }
}

/** Fetch several media assets by id (ignores nulls), as a lookup map. */
export async function getMediaMap(ids: (string | null | undefined)[]): Promise<Map<string, MediaRef>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (unique.length === 0) return new Map();
  const rows = await db.mediaAsset.findMany({ where: { id: { in: unique } }, select: MEDIA_SELECT });
  return new Map(rows.map((r) => [r.id, r]));
}

export async function getMedia(id: string | null | undefined): Promise<MediaRef | null> {
  if (!id) return null;
  return db.mediaAsset.findUnique({ where: { id }, select: MEDIA_SELECT });
}

/**
 * Where a media asset is used. Settings and page content store media ids
 * inside JSON, so they are searched as text.
 */
export async function findMediaUsage(id: string): Promise<string[]> {
  const [meals, mealImages, gallery, promos, blogs, seo, testimonials, landing, settings, content] = await Promise.all([
    db.meal.count({ where: { imageId: id } }),
    db.mealImage.count({ where: { mediaAssetId: id } }),
    db.galleryItem.count({ where: { mediaAssetId: id } }),
    db.promotion.count({ where: { imageId: id } }),
    db.blogPost.count({ where: { OR: [{ coverImageId: id }, { ogImageId: id }, { contentHtml: { contains: id } }] } }),
    db.sEOPageMetadata.count({ where: { ogImageId: id } }),
    db.testimonial.count({ where: { photoId: id } }),
    db.seasonalCampaignLandingPage.count({ where: { OR: [{ heroImageId: id }, { ogImageId: id }] } }),
    db.$queryRaw<{ key: string }[]>`SELECT key FROM "SiteSetting" WHERE value::text LIKE ${"%" + id + "%"}`,
    db.$queryRaw<{ key: string }[]>`SELECT key FROM "PageContent" WHERE data::text LIKE ${"%" + id + "%"}`,
  ]);
  const usage: string[] = [];
  if (meals + mealImages) usage.push(`${meals + mealImages} meal(s)`);
  if (gallery) usage.push(`${gallery} gallery item(s)`);
  if (promos) usage.push(`${promos} promotion(s)`);
  if (blogs) usage.push(`${blogs} blog post(s)`);
  if (seo) usage.push(`${seo} SEO page(s)`);
  if (testimonials) usage.push(`${testimonials} testimonial(s)`);
  if (landing) usage.push(`${landing} offer page(s)`);
  for (const s of settings) usage.push(`settings: ${s.key}`);
  for (const c of content) usage.push(`page content: ${c.key}`);
  return usage;
}
