"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, fdString, handleActionError, ok, type ActionState } from "@/lib/actions";
import { slugField } from "@/lib/admin/fields";
import {
  PromotionConflictError,
  SEASONAL_THEMES,
  createPromotion,
  deletePromotion,
  duplicatePromotion,
  parsePromotionForm,
  setPromotionEnabled,
  updatePromotion,
} from "@/lib/admin/promotions";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { revalidatePublicSite } from "@/lib/revalidate";
import { getSettingsGroup } from "@/lib/settings";

function refresh(id?: string) {
  revalidatePath("/admin/promotions");
  if (id) revalidatePath(`/admin/promotions/${id}`);
  revalidatePublicSite();
}

function unmatchedNote(unmatched: string[]) {
  if (unmatched.length === 0) return "";
  const list = unmatched.slice(0, 5).join(", ");
  return ` ${unmatched.length} email(s) didn't match an existing customer: ${list}${unmatched.length > 5 ? "…" : ""}`;
}

export async function savePromotion(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const admin = await assertAdmin(AREA_ROLES.promotions);
    const { timeZone } = await getSettingsGroup("business");
    const input = parsePromotionForm(fd, timeZone);
    if (id) {
      const { unmatched } = await updatePromotion(admin, id, input);
      refresh(id);
      return ok(`Campaign saved.${unmatchedNote(unmatched)}`);
    }
    const { promotion } = await createPromotion(admin, input);
    createdId = promotion.id;
    refresh();
  } catch (error) {
    if (error instanceof PromotionConflictError) {
      return fail("Please check the highlighted fields.", { [error.field]: error.message });
    }
    return handleActionError(error);
  }
  redirect(`/admin/promotions/${createdId}?created=1`);
}

export async function togglePromotion(id: string, enabled: boolean): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.promotions);
    await setPromotionEnabled(admin, id, enabled);
    refresh(id);
    return ok(enabled ? "Campaign enabled — it goes live at its start time" : "Campaign disabled — discounts stop immediately");
  } catch (error) {
    return handleActionError(error);
  }
}

const duplicateSchema = z.object({
  name: z.string().trim().min(2, "Name the new campaign.").max(100),
  slug: slugField(),
  theme: z.enum(SEASONAL_THEMES),
});

export async function duplicatePromotionAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let newId: string;
  try {
    const admin = await assertAdmin(AREA_ROLES.promotions);
    const input = duplicateSchema.parse({ name: fdString(fd, "name"), slug: fdString(fd, "slug"), theme: fdString(fd, "theme") });
    const copy = await duplicatePromotion(admin, id, input);
    newId = copy.id;
    refresh();
  } catch (error) {
    if (error instanceof PromotionConflictError) return fail("Please check the highlighted fields.", { slug: error.message });
    return handleActionError(error);
  }
  redirect(`/admin/promotions/${newId}?duplicated=1`);
}

export async function removePromotion(id: string): Promise<ActionState> {
  let result: "deleted" | "blocked";
  try {
    const admin = await assertAdmin(AREA_ROLES.promotions);
    result = await deletePromotion(admin, id);
  } catch (error) {
    return handleActionError(error);
  }
  if (result === "blocked") {
    return fail("This campaign has order requests linked to it, so it's kept for your records. Disable it instead.");
  }
  refresh();
  redirect("/admin/promotions?deleted=1");
}
