"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, fdBool, handleActionError, ok, type ActionState } from "@/lib/actions";
import { createMeal, deleteMeal, isSlugTaken, parseMealForm, setMealArchived, toggleMealFlag, updateMeal } from "@/lib/admin/meals";
import { moveItem } from "@/lib/admin/reorder";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { revalidatePublicSite } from "@/lib/revalidate";

function refresh(id?: string) {
  revalidatePath("/admin/meals");
  if (id) revalidatePath(`/admin/meals/${id}`);
  revalidatePublicSite();
}

const SLUG_TAKEN = fail("Please check the highlighted fields.", { slug: "Another meal already uses this web address." });

export async function saveMeal(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const admin = await assertAdmin(AREA_ROLES.meals);
    const input = parseMealForm(fd);
    if (id) {
      const { redirect: r } = await updateMeal(admin, id, input, { createRedirect: fdBool(fd, "createRedirect") });
      refresh(id);
      return ok(r ? `Meal saved. Old address ${r.from} now redirects to ${r.to}.` : "Meal saved");
    }
    const meal = await createMeal(admin, input);
    createdId = meal.id;
    refresh();
  } catch (error) {
    if (isSlugTaken(error)) return SLUG_TAKEN;
    return handleActionError(error);
  }
  redirect(`/admin/meals/${createdId}?created=1`);
}

export async function toggleMeal(id: string, flag: "isPublished" | "isFeatured"): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.meals);
    const value = await toggleMealFlag(admin, id, flag);
    refresh(id);
    if (flag === "isPublished") return ok(value ? "Meal is now on the website" : "Meal hidden from the website");
    return ok(value ? "Meal featured on the homepage" : "Meal no longer featured");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function archiveMeal(id: string, archived: boolean): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.meals);
    await setMealArchived(admin, id, archived);
    refresh(id);
    return ok(archived ? "Meal archived — it's hidden from the website" : "Meal restored");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function removeMeal(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.meals);
    await deleteMeal(admin, id);
    refresh();
  } catch (error) {
    return handleActionError(error);
  }
  redirect("/admin/meals?deleted=1");
}

export async function moveMeal(id: string, direction: "up" | "down"): Promise<ActionState> {
  try {
    await assertAdmin(AREA_ROLES.meals);
    await moveItem("meal", id, direction);
    refresh();
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}
