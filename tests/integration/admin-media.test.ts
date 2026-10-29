import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { removeMedia } from "@/app/admin/(dashboard)/media/actions";
import { toggleTestimonial } from "@/app/admin/(dashboard)/testimonials/actions";
import { bulkAddGalleryItems, createGalleryItem, deleteGalleryItem, parseGalleryForm } from "@/lib/admin/gallery";
import { MediaInUseError, deleteMedia, replaceMediaFile } from "@/lib/admin/media";
import { createTestimonial, parseTestimonialForm } from "@/lib/admin/testimonials";
import { db } from "@/lib/db";
import { createMediaAsset } from "@/lib/media";
import { form, runAction } from "./admin-form-utils";
import { signInAs } from "./helpers";

async function png(color = "#080808") {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: color } }).png().toBuffer();
}

async function upload() {
  return createMediaAsset({ file: { name: "meal.png", buffer: await png() }, category: "GALLERY", altText: "Test meal" });
}

const stored = (key: string) => path.resolve(process.env.UPLOAD_DIR ?? "./storage/test-uploads", key);

describe("media library", () => {
  it("blocks deleting images that are in use, then deletes record and file", async () => {
    const admin = await signInAs("EDITOR");
    const media = await upload();
    expect(existsSync(stored(media.storageKey))).toBe(true);
    const item = await createGalleryItem(admin, parseGalleryForm(form({ mediaAssetId: media.id, isPublished: true })));

    await expect(deleteMedia(admin, media.id)).rejects.toBeInstanceOf(MediaInUseError);
    const viaAction = await removeMedia(media.id);
    expect(viaAction.ok).toBe(false);
    expect(viaAction.message).toMatch(/gallery item/);

    await deleteGalleryItem(admin, item.id);
    const res = await runAction(() => removeMedia(media.id));
    expect(res.redirectTo).toContain("/admin/media");
    expect(await db.mediaAsset.findUnique({ where: { id: media.id } })).toBeNull();
    expect(existsSync(stored(media.storageKey))).toBe(false);
  });

  it("replaces the file but keeps the same record", async () => {
    const admin = await signInAs("EDITOR");
    const media = await upload();
    const replaced = await replaceMediaFile(admin, media.id, { name: "new-photo.png", buffer: await png("#ffffff") });
    expect(replaced.id).toBe(media.id);
    expect(replaced.storageKey).not.toBe(media.storageKey);
    expect(existsSync(stored(media.storageKey))).toBe(false);
    expect(existsSync(stored(replaced.storageKey))).toBe(true);
  });
});

describe("instagram gallery", () => {
  it("only accepts Instagram links", () => {
    expect(() => parseGalleryForm(form({ mediaAssetId: "x", instagramUrl: "https://evil.example/p/1" }))).toThrow(ZodError);
    expect(parseGalleryForm(form({ mediaAssetId: "x", instagramUrl: "" })).instagramUrl).toBeNull();
    expect(parseGalleryForm(form({ mediaAssetId: "x", instagramUrl: "https://www.instagram.com/p/abc/" })).instagramUrl).toContain("instagram.com");
  });

  it("bulk-adds uploaded photos at the end of the list", async () => {
    const admin = await signInAs("EDITOR");
    const a = await upload();
    const b = await upload();
    expect(await bulkAddGalleryItems(admin, [a.id, b.id, "missing"])).toBe(2);
    const items = await db.galleryItem.findMany({ orderBy: { sortOrder: "asc" } });
    expect(items.map((i) => i.mediaAssetId)).toEqual([a.id, b.id]);
    expect(items[0].altText).toBe("Test meal");
  });
});

describe("testimonials", () => {
  it("requires a recorded permission before publishing", async () => {
    const admin = await signInAs("EDITOR");
    expect(() => parseTestimonialForm(form({ quote: "Great food!", displayName: "M.B.", isPublished: true }))).toThrow(/permission/);

    const draft = await createTestimonial(admin, parseTestimonialForm(form({ quote: "Great food!", displayName: "M.B." })));
    const res = await toggleTestimonial(draft.id);
    expect(res.ok).toBe(false);
    expect((await db.testimonial.findUniqueOrThrow({ where: { id: draft.id } })).isPublished).toBe(false);

    const ok = await createTestimonial(
      admin,
      parseTestimonialForm(form({ quote: "Great food!", displayName: "M.B.", consentDate: "2026-10-20", isPublished: true })),
    );
    expect(ok.isPublished).toBe(true);
    expect(ok.consentRecordedAt?.toISOString()).toBe("2026-10-20T10:00:00.000Z");
  });
});
