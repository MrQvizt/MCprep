"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, fdBool, handleActionError, ok, type ActionState } from "@/lib/actions";
import {
  LandingSlugTakenError,
  createLandingPage,
  deleteLandingPage,
  parseLandingForm,
  toggleLandingPublished,
  updateLandingPage,
} from "@/lib/admin/landing-pages";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { revalidatePublicSite } from "@/lib/revalidate";

function refresh(id?: string) {
  revalidatePath("/admin/landing-pages");
  if (id) revalidatePath(`/admin/landing-pages/${id}`);
  revalidatePublicSite();
}

export async function saveLandingPage(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const admin = await assertAdmin(AREA_ROLES.promotions);
    const input = parseLandingForm(fd);
    if (id) {
      const { redirect: r } = await updateLandingPage(admin, id, input, { createRedirect: fdBool(fd, "createRedirect") });
      refresh(id);
      return ok(r ? `Page saved. ${r.from} now redirects to ${r.to}.` : "Page saved");
    }
    const page = await createLandingPage(admin, input);
    createdId = page.id;
    refresh();
  } catch (error) {
    if (error instanceof LandingSlugTakenError) {
      return fail("Please check the highlighted fields.", { slug: "Another offer page already uses this address." });
    }
    return handleActionError(error);
  }
  redirect(`/admin/landing-pages/${createdId}?created=1`);
}

export async function toggleLanding(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.promotions);
    const published = await toggleLandingPublished(admin, id);
    refresh(id);
    return ok(published ? "Page published" : "Page unpublished");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function removeLanding(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.promotions);
    await deleteLandingPage(admin, id);
    refresh();
  } catch (error) {
    return handleActionError(error);
  }
  redirect("/admin/landing-pages?deleted=1");
}
