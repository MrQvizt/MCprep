"use server";

import { revalidatePath } from "next/cache";
import { fail, fdString, fromZodError, handleActionError, ok, type ActionState } from "@/lib/actions";
import { AccountError, changeOwnPassword, passwordChangeSchema, profileSchema, updateOwnProfile } from "@/lib/admin/account";
import { signOut } from "@/lib/auth";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";

export async function updateProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.account);
    const parsed = profileSchema.safeParse({
      name: fdString(fd, "name"),
      email: fdString(fd, "email"),
      currentPassword: String(fd.get("currentPassword") ?? ""),
    });
    if (!parsed.success) return fromZodError(parsed.error);
    const { emailChanged } = await updateOwnProfile(admin, parsed.data);
    revalidatePath("/admin", "layout");
    return ok(emailChanged ? "Saved. Use your new email next time you sign in." : "Profile saved");
  } catch (error) {
    if (error instanceof AccountError) return fail(error.message, error.fieldErrors);
    return handleActionError(error);
  }
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState<{ signedOut: boolean }>> {
  try {
    const admin = await assertAdmin(AREA_ROLES.account);
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: String(fd.get("currentPassword") ?? ""),
      newPassword: String(fd.get("newPassword") ?? ""),
      confirmPassword: String(fd.get("confirmPassword") ?? ""),
    });
    if (!parsed.success) return fromZodError(parsed.error);
    await changeOwnPassword(admin, parsed.data);
    await signOut({ redirect: false });
    return ok("Password changed. Please sign in again with your new password.", { signedOut: true });
  } catch (error) {
    if (error instanceof AccountError) return fail(error.message, error.fieldErrors);
    return handleActionError(error);
  }
}
