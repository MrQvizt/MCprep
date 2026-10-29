"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, handleActionError, ok, type ActionState } from "@/lib/actions";
import { moveItem } from "@/lib/admin/reorder";
import {
  ConsentRequiredError,
  createTestimonial,
  deleteTestimonial,
  parseTestimonialForm,
  toggleTestimonialPublished,
  updateTestimonial,
} from "@/lib/admin/testimonials";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { revalidatePublicSite } from "@/lib/revalidate";

function refresh() {
  revalidatePath("/admin/testimonials");
  revalidatePublicSite();
}

export async function saveTestimonial(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.testimonials);
    const input = parseTestimonialForm(fd);
    if (id) {
      await updateTestimonial(admin, id, input);
      refresh();
      return ok("Testimonial saved");
    }
    await createTestimonial(admin, input);
    refresh();
  } catch (error) {
    return handleActionError(error);
  }
  redirect("/admin/testimonials?created=1");
}

export async function toggleTestimonial(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.testimonials);
    const published = await toggleTestimonialPublished(admin, id);
    refresh();
    return ok(published ? "Testimonial published" : "Testimonial hidden");
  } catch (error) {
    if (error instanceof ConsentRequiredError) return fail(error.message);
    return handleActionError(error);
  }
}

export async function moveTestimonial(id: string, direction: "up" | "down"): Promise<ActionState> {
  try {
    await assertAdmin(AREA_ROLES.testimonials);
    await moveItem("testimonial", id, direction);
    refresh();
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function removeTestimonial(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.testimonials);
    await deleteTestimonial(admin, id);
    refresh();
    return ok("Testimonial deleted");
  } catch (error) {
    return handleActionError(error);
  }
}
