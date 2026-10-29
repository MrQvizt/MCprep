import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { slugify } from "@/lib/urls";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);
const MAX_DIMENSION = 2400;

export class ImageValidationError extends Error {}

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
}

/**
 * Validate an uploaded image by decoding it (not trusting the file name or
 * declared type), auto-rotate, strip metadata (EXIF/GPS), resize and re-encode.
 * `keepPng` preserves PNG output for logos/favicons.
 */
export async function processImageUpload(input: Buffer, opts: { keepPng?: boolean } = {}): Promise<ProcessedImage> {
  if (input.byteLength === 0) throw new ImageValidationError("The file is empty.");
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new ImageValidationError("Images must be 10 MB or smaller.");

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new ImageValidationError("This file isn't a supported image. Use JPG, PNG, WebP or AVIF.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new ImageValidationError("Unsupported image format. Use JPG, PNG, WebP or AVIF.");
  }
  if (!meta.width || !meta.height || meta.width < 16 || meta.height < 16) {
    throw new ImageValidationError("The image is too small.");
  }

  const pipeline = sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });

  const asPng = Boolean(opts.keepPng);
  const { data, info } = asPng
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
    : await pipeline.webp({ quality: 84 }).toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    mimeType: asPng ? "image/png" : "image/webp",
    extension: asPng ? "png" : "webp",
    width: info.width,
    height: info.height,
  };
}

/** Storage key like "meal/2026/10/k3j2h1-chicken-poke-bowl.webp" */
export function buildStorageKey(category: string, originalName: string, extension: string, now = new Date()): string {
  const base = slugify(originalName.replace(/\.[a-z0-9]+$/i, "")) || "image";
  const rand = randomBytes(5).toString("hex");
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${category.toLowerCase()}/${yyyy}/${mm}/${rand}-${base.slice(0, 50)}.${extension}`;
}
