import { revalidatePath } from "next/cache";
import { replaceMediaFile } from "@/lib/admin/media";
import { AREA_ROLES, AuthorizationError, assertAdmin } from "@/lib/authz";
import { ImageValidationError, MAX_UPLOAD_BYTES } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";
import { revalidatePublicSite } from "@/lib/revalidate";

/** Replace the file behind an existing media record (keeps its id, so every usage updates). */
export async function POST(request: Request, ctx: RouteContext<"/admin/media/[id]/replace">) {
  try {
    const admin = await assertAdmin(AREA_ROLES.media);
    const limited = await rateLimit(`upload:${admin.id}`, 60, 10 * 60);
    if (!limited.ok) return Response.json({ error: "Too many uploads. Please wait a few minutes." }, { status: 429 });
    if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 512 * 1024) {
      return Response.json({ error: "Images must be 10 MB or smaller." }, { status: 413 });
    }
    const { id } = await ctx.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose an image to upload." }, { status: 400 });
    const asset = await replaceMediaFile(admin, id, { name: file.name || "image", buffer: Buffer.from(await file.arrayBuffer()) });
    revalidatePath("/admin/media");
    revalidatePath(`/admin/media/${id}`);
    revalidatePublicSite();
    return Response.json({ item: { id: asset.id, url: asset.url } });
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: error.message }, { status: 401 });
    if (error instanceof ImageValidationError) return Response.json({ error: error.message }, { status: 400 });
    if ((error as { code?: string }).code === "P2025") return Response.json({ error: "Image not found." }, { status: 404 });
    console.error("[media replace]", error);
    return Response.json({ error: "Replace failed. Please try again." }, { status: 500 });
  }
}
