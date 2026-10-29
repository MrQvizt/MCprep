import "server-only";
import { z } from "zod";
import { logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { buildStorageKey, processImageUpload } from "@/lib/images";
import { findMediaUsage } from "@/lib/media";
import { storage } from "@/lib/storage";
import { MediaCategory } from "@/generated/prisma/enums";

export const MEDIA_CATEGORIES = Object.values(MediaCategory) as [MediaCategory, ...MediaCategory[]];

export const OVERSIZED_BYTES = 1.5 * 1024 * 1024;
export const OVERSIZED_PX = 3000;

export function isOversized(m: { sizeBytes: number; width: number | null; height: number | null }) {
  return m.sizeBytes > OVERSIZED_BYTES || (m.width ?? 0) > OVERSIZED_PX || (m.height ?? 0) > OVERSIZED_PX;
}

export const mediaDetailsSchema = z.object({
  altText: z
    .string()
    .trim()
    .max(300, "Alt text must be 300 characters or fewer.")
    .transform((v) => (v === "" ? null : v)),
  caption: z
    .string()
    .trim()
    .max(500, "Caption must be 500 characters or fewer.")
    .transform((v) => (v === "" ? null : v)),
  category: z.enum(MEDIA_CATEGORIES),
});

export async function updateMediaDetails(actor: AuditActor, id: string, input: z.infer<typeof mediaDetailsSchema>) {
  const asset = await db.mediaAsset.update({ where: { id }, data: input });
  await logAudit({ actor, action: "media.update", entityType: "MediaAsset", entityId: id, summary: `Updated details of ${asset.filename}` });
  return asset;
}

/**
 * Replace the image file but keep the same media record, so every page using
 * it updates automatically. The old file is removed from storage.
 */
export async function replaceMediaFile(actor: AuditActor, id: string, file: { name: string; buffer: Buffer }) {
  const existing = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
  const processed = await processImageUpload(file.buffer, { keepPng: existing.category === "BRANDING" });
  const key = buildStorageKey(existing.category, file.name, processed.extension);
  const stored = await storage().put(key, processed.buffer, processed.mimeType);
  let asset;
  try {
    asset = await db.mediaAsset.update({
      where: { id },
      data: {
        storageKey: stored.key,
        url: stored.url,
        filename: file.name.slice(0, 200),
        mimeType: processed.mimeType,
        sizeBytes: processed.buffer.byteLength,
        width: processed.width,
        height: processed.height,
        isPlaceholder: false,
      },
    });
  } catch (error) {
    await storage().delete(stored.key).catch(() => undefined);
    throw error;
  }
  await storage()
    .delete(existing.storageKey)
    .catch((e) => console.error("[media] failed to delete replaced file", e));
  await logAudit({
    actor,
    action: "media.replace",
    entityType: "MediaAsset",
    entityId: id,
    summary: `Replaced image ${existing.filename} with ${asset.filename}`,
  });
  return asset;
}

export class MediaInUseError extends Error {
  constructor(readonly usage: string[]) {
    super(`This image is still used in: ${usage.join(", ")}. Remove it there first.`);
    this.name = "MediaInUseError";
  }
}

/** Delete an unused image (record + stored file). Throws MediaInUseError if referenced. */
export async function deleteMedia(actor: AuditActor, id: string) {
  const usage = await findMediaUsage(id);
  if (usage.length > 0) throw new MediaInUseError(usage);
  const asset = await db.mediaAsset.delete({ where: { id } });
  await storage()
    .delete(asset.storageKey)
    .catch((e) => console.error("[media] failed to delete file", e));
  await logAudit({ actor, action: "media.delete", entityType: "MediaAsset", entityId: id, summary: `Deleted image ${asset.filename}` });
  return asset;
}

export const MEDIA_CATEGORY_NAMES: Record<MediaCategory, string> = {
  GENERAL: "General",
  MEAL: "Meals",
  HERO: "Hero & banners",
  GALLERY: "Instagram gallery",
  BLOG: "Blog",
  BRANDING: "Branding (logo, favicon)",
  SOCIAL: "Social sharing",
  PROMOTION: "Promotions",
  TESTIMONIAL: "Testimonials",
};
