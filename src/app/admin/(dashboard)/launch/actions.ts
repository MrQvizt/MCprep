"use server";

import { revalidatePath } from "next/cache";
import { fail, handleActionError, ok, type ActionState } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { isValidChecklistKey, setChecklistItem } from "@/lib/launch";

/** Tick or untick a launch, monthly or Google Business Profile checklist item. */
export async function setChecklistItemAction(key: string, done: boolean): Promise<ActionState> {
  try {
    const admin = await assertAdmin(key.startsWith("gbp.") ? AREA_ROLES.listings : AREA_ROLES.launch);
    if (!isValidChecklistKey(key)) return fail("Unknown checklist item.");
    await setChecklistItem(key, done, admin.id);
    await logAudit({ actor: admin, action: done ? "checklist.done" : "checklist.undone", entityType: "ChecklistItemState", entityId: key, summary: `${done ? "Ticked" : "Unticked"} ${key}` });
    revalidatePath("/admin/launch");
    revalidatePath("/admin/listings");
    return ok();
  } catch (error) {
    return handleActionError(error);
  }
}
