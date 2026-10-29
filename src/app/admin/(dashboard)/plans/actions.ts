"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, handleActionError, ok, type ActionState } from "@/lib/actions";
import {
  PlanSlugTakenError,
  createPlan,
  deleteOrArchivePlan,
  parsePlanForm,
  setPlanArchived,
  setRecommendedPlan,
  togglePlanActive,
  updatePlan,
} from "@/lib/admin/plans";
import { moveItem } from "@/lib/admin/reorder";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { revalidatePublicSite } from "@/lib/revalidate";

function refresh(id?: string) {
  revalidatePath("/admin/plans");
  if (id) revalidatePath(`/admin/plans/${id}`);
  revalidatePublicSite();
}

export async function savePlan(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const admin = await assertAdmin(AREA_ROLES.plans);
    const input = parsePlanForm(fd);
    if (id) {
      await updatePlan(admin, id, input);
      refresh(id);
      return ok("Plan saved. Existing orders keep the price they were quoted.");
    }
    const plan = await createPlan(admin, input);
    createdId = plan.id;
    refresh();
  } catch (error) {
    if (error instanceof PlanSlugTakenError) {
      return fail("Please check the highlighted fields.", { slug: "Another plan already uses this web address." });
    }
    return handleActionError(error);
  }
  redirect(`/admin/plans/${createdId}?created=1`);
}

export async function togglePlan(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.plans);
    const active = await togglePlanActive(admin, id);
    refresh(id);
    return ok(active ? "Plan is now available to order" : "Plan hidden — customers can no longer choose it");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function recommendPlan(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.plans);
    await setRecommendedPlan(admin, id);
    refresh(id);
    return ok("Recommended plan updated");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function archivePlan(id: string, archived: boolean): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.plans);
    await setPlanArchived(admin, id, archived);
    refresh(id);
    return ok(archived ? "Plan archived" : "Plan restored (still hidden — enable it when ready)");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function removePlan(id: string): Promise<ActionState> {
  let result: "deleted" | "archived";
  try {
    const admin = await assertAdmin(AREA_ROLES.plans);
    result = await deleteOrArchivePlan(admin, id);
    refresh(id);
  } catch (error) {
    return handleActionError(error);
  }
  if (result === "archived") return ok("This plan has orders, so it was archived instead of deleted.");
  redirect("/admin/plans?deleted=1");
}

export async function movePlan(id: string, direction: "up" | "down"): Promise<ActionState> {
  try {
    await assertAdmin(AREA_ROLES.plans);
    await moveItem("plan", id, direction, { archivedAt: null });
    refresh();
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}
