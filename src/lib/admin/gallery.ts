import "server-only";
import { z } from "zod";
import { fdBool, fdString } from "@/lib/actions";
import { nextSortOrder } from "@/lib/admin/reorder";
import { logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { instagramUrlField, optionalText } from "./fields";

export const galleryItemSchema = z.object({
  mediaAssetId: z.string().trim().min(1, "Choose a photo."),
  caption: optionalText("Caption", 300),
  altText: optionalText("Alt text", 300),
  instagramUrl: instagramUrlField,
  isPublished: z.boolean(),
  isFeatured: z.boolean(),
});

export type GalleryItemInput = z.infer<typeof galleryItemSchema>;

export function parseGalleryForm(fd: FormData) {
  return galleryItemSchema.parse({
    mediaAssetId: fdString(fd, "mediaAssetId"),
    caption: fdString(fd, "caption"),
    altText: fdString(fd, "altText"),
    instagramUrl: fdString(fd, "instagramUrl"),
    isPublished: fdBool(fd, "isPublished"),
    isFeatured: fdBool(fd, "isFeatured"),
  });
}

async function assertMedia(id: string) {
  const media = await db.mediaAsset.findUnique({ where: { id }, select: { id: true } });
  if (!media) throw new z.ZodError([{ code: "custom", path: ["mediaAssetId"], message: "That photo no longer exists.", input: id }]);
}

export async function createGalleryItem(actor: AuditActor, input: GalleryItemInput) {
  await assertMedia(input.mediaAssetId);
  const item = await db.galleryItem.create({ data: { ...input, sortOrder: await nextSortOrder("galleryItem") } });
  await logAudit({ actor, action: "gallery.create", entityType: "GalleryItem", entityId: item.id, summary: "Added a gallery photo" });
  return item;
}

export async function updateGalleryItem(actor: AuditActor, id: string, input: GalleryItemInput) {
  await assertMedia(input.mediaAssetId);
  const item = await db.galleryItem.update({ where: { id }, data: { ...input, isDemo: false } });
  await logAudit({ actor, action: "gallery.update", entityType: "GalleryItem", entityId: id, summary: "Updated a gallery photo" });
  return item;
}

/** Add several uploaded photos at once (published + featured, linking to the profile). */
export async function bulkAddGalleryItems(actor: AuditActor, mediaIds: string[]) {
  const unique = [...new Set(mediaIds)].slice(0, 30);
  const media = await db.mediaAsset.findMany({ where: { id: { in: unique } }, select: { id: true, altText: true } });
  const byId = new Map(media.map((m) => [m.id, m]));
  let order = await nextSortOrder("galleryItem");
  const data = unique
    .filter((id) => byId.has(id))
    .map((id) => ({
      mediaAssetId: id,
      altText: byId.get(id)!.altText,
      isPublished: true,
      isFeatured: true,
      sortOrder: order++,
    }));
  if (data.length === 0) return 0;
  await db.galleryItem.createMany({ data });
  await logAudit({ actor, action: "gallery.bulk_add", entityType: "GalleryItem", summary: `Added ${data.length} gallery photo(s)` });
  return data.length;
}

export async function toggleGalleryFlag(actor: AuditActor, id: string, flag: "isPublished" | "isFeatured") {
  const item = await db.galleryItem.findUniqueOrThrow({ where: { id } });
  const value = !item[flag];
  await db.galleryItem.update({ where: { id }, data: { [flag]: value } });
  await logAudit({
    actor,
    action: `gallery.${flag}`,
    entityType: "GalleryItem",
    entityId: id,
    summary: `${flag === "isPublished" ? (value ? "Published" : "Hid") : value ? "Featured" : "Un-featured"} a gallery photo`,
  });
  return value;
}

export async function deleteGalleryItem(actor: AuditActor, id: string) {
  await db.galleryItem.delete({ where: { id } });
  await logAudit({ actor, action: "gallery.delete", entityType: "GalleryItem", entityId: id, summary: "Removed a gallery photo (image kept in the media library)" });
}
