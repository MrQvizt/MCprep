import { z } from "zod";
import { assertAdmin, AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ImageValidationError, MAX_UPLOAD_BYTES } from "@/lib/images";
import { createMediaAsset } from "@/lib/media";
import { rateLimit } from "@/lib/rate-limit";
import { MediaCategory } from "@/generated/prisma/enums";

const CATEGORIES = Object.values(MediaCategory) as [string, ...string[]];

function errorResponse(error: unknown) {
  if (error instanceof AuthorizationError) return Response.json({ error: error.message }, { status: 401 });
  if (error instanceof ImageValidationError) return Response.json({ error: error.message }, { status: 400 });
  console.error("[media api]", error);
  return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
}

/** List media for the picker / library. */
export async function GET(request: Request) {
  try {
    await assertAdmin("EDITOR");
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q")?.trim().slice(0, 100);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const take = 30;
    const where = {
      ...(category && CATEGORIES.includes(category) ? { category: category as MediaCategory } : {}),
      ...(q ? { OR: [{ filename: { contains: q, mode: "insensitive" as const } }, { altText: { contains: q, mode: "insensitive" as const } }] } : {}),
    };
    const [items, total] = await Promise.all([
      db.mediaAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * take,
        take,
        select: { id: true, url: true, width: true, height: true, altText: true, filename: true, category: true, sizeBytes: true },
      }),
      db.mediaAsset.count({ where }),
    ]);
    return Response.json({ items, total, page, pages: Math.max(1, Math.ceil(total / take)) });
  } catch (error) {
    return errorResponse(error);
  }
}

const uploadSchema = z.object({
  category: z.enum(CATEGORIES).default("GENERAL"),
  altText: z.string().trim().max(300).optional(),
});

/** Upload an image (validated, re-encoded, metadata stripped). */
export async function POST(request: Request) {
  try {
    const admin = await assertAdmin("EDITOR");
    const limited = await rateLimit(`upload:${admin.id}`, 60, 10 * 60);
    if (!limited.ok) return Response.json({ error: "Too many uploads. Please wait a few minutes." }, { status: 429 });

    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES + 512 * 1024) {
      return Response.json({ error: "Images must be 10 MB or smaller." }, { status: 413 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose an image to upload." }, { status: 400 });
    const meta = uploadSchema.safeParse({
      category: form.get("category") || undefined,
      altText: form.get("altText") || undefined,
    });
    if (!meta.success) return Response.json({ error: "Invalid upload details." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await createMediaAsset({
      file: { name: file.name || "image", buffer },
      category: meta.data.category as MediaCategory,
      altText: meta.data.altText,
      uploadedById: admin.id,
    });
    await logAudit({
      actor: admin,
      action: "media.upload",
      entityType: "MediaAsset",
      entityId: asset.id,
      summary: `Uploaded ${asset.filename}`,
    });
    return Response.json({
      item: { id: asset.id, url: asset.url, width: asset.width, height: asset.height, altText: asset.altText, filename: asset.filename, category: asset.category, sizeBytes: asset.sizeBytes },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
