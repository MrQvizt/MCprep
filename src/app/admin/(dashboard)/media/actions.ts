"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, fdString, handleActionError, ok, type ActionState } from "@/lib/actions";
import { MediaInUseError, deleteMedia, mediaDetailsSchema, updateMediaDetails } from "@/lib/admin/media";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { revalidatePublicSite } from "@/lib/revalidate";

export async function saveMediaDetails(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.media);
    const input = mediaDetailsSchema.parse({
      altText: fdString(fd, "altText"),
      caption: fdString(fd, "caption"),
      category: fdString(fd, "category"),
    });
    await updateMediaDetails(admin, id, input);
    revalidatePath("/admin/media");
    revalidatePath(`/admin/media/${id}`);
    revalidatePublicSite();
    return ok("Image details saved");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function removeMedia(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.media);
    await deleteMedia(admin, id);
    revalidatePath("/admin/media");
  } catch (error) {
    if (error instanceof MediaInUseError) return fail(error.message);
    return handleActionError(error);
  }
  redirect("/admin/media?deleted=1");
}
