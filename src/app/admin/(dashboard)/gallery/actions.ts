"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleActionError, ok, type ActionState } from "@/lib/actions";
import {
  bulkAddGalleryItems,
  createGalleryItem,
  deleteGalleryItem,
  parseGalleryForm,
  toggleGalleryFlag,
  updateGalleryItem,
} from "@/lib/admin/gallery";
import { moveItem } from "@/lib/admin/reorder";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { revalidatePublicSite } from "@/lib/revalidate";

function refresh() {
  revalidatePath("/admin/gallery");
  revalidatePublicSite();
}

export async function saveGalleryItem(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.gallery);
    const input = parseGalleryForm(fd);
    if (id) {
      await updateGalleryItem(admin, id, input);
      refresh();
      return ok("Photo saved");
    }
    await createGalleryItem(admin, input);
    refresh();
  } catch (error) {
    return handleActionError(error);
  }
  redirect("/admin/gallery?added=1");
}

export async function bulkAddGallery(mediaIds: string[]): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.gallery);
    const count = await bulkAddGalleryItems(admin, mediaIds);
    refresh();
    return ok(`${count} photo(s) added to the gallery`);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function toggleGallery(id: string, flag: "isPublished" | "isFeatured"): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.gallery);
    const value = await toggleGalleryFlag(admin, id, flag);
    refresh();
    if (flag === "isPublished") return ok(value ? "Photo shown on the website" : "Photo hidden");
    return ok(value ? "Photo shown on the homepage" : "Photo removed from the homepage");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function moveGallery(id: string, direction: "up" | "down"): Promise<ActionState> {
  try {
    await assertAdmin(AREA_ROLES.gallery);
    await moveItem("galleryItem", id, direction);
    refresh();
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function removeGalleryItem(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.gallery);
    await deleteGalleryItem(admin, id);
    refresh();
    return ok("Photo removed from the gallery (it's still in your media library)");
  } catch (error) {
    return handleActionError(error);
  }
}
