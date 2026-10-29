"use server";

import { revalidatePath } from "next/cache";
import { fail, fdString, fromZodError, handleActionError, ok, type ActionState } from "@/lib/actions";
import { generateTemporaryPassword, guardUserChange, newUserSchema, resetPasswordSchema, updateUserSchema, UserGuardError } from "@/lib/admin/users";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin, ROLE_LABELS } from "@/lib/authz";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";

function refresh(id?: string) {
  revalidatePath("/admin/users");
  if (id) revalidatePath(`/admin/users/${id}`);
}

function guardError(error: unknown): ActionState | null {
  return error instanceof UserGuardError ? fail(error.message) : null;
}

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState<{ id: string; email: string; tempPassword?: string }>> {
  try {
    const admin = await assertAdmin(AREA_ROLES.users);
    const parsed = newUserSchema.safeParse({
      name: fdString(fd, "name"),
      email: fdString(fd, "email"),
      role: fdString(fd, "role") || "EDITOR",
      passwordMode: fdString(fd, "passwordMode") || "generate",
      password: String(fd.get("password") ?? ""),
    });
    if (!parsed.success) return fromZodError(parsed.error);
    const d = parsed.data;
    const tempPassword = d.passwordMode === "generate" ? generateTemporaryPassword() : undefined;
    const user = await db.adminUser.create({
      data: { name: d.name, email: d.email, role: d.role, passwordHash: await hashPassword(tempPassword ?? d.password) },
    });
    await logAudit({
      actor: admin,
      action: "adminUser.create",
      entityType: "AdminUser",
      entityId: user.id,
      summary: `Created ${ROLE_LABELS[user.role].toLowerCase()} account for ${user.email}`,
    });
    refresh();
    return ok(`Account created for ${user.email}`, { id: user.id, email: user.email, tempPassword });
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateUserAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.users);
    const parsed = updateUserSchema.safeParse({ name: fdString(fd, "name"), role: fdString(fd, "role") });
    if (!parsed.success) return fromZodError(parsed.error);
    const target = await db.adminUser.findUniqueOrThrow({ where: { id } });
    await guardUserChange(admin.id, target, { role: parsed.data.role });
    const roleChanged = parsed.data.role !== target.role;
    await db.adminUser.update({
      where: { id },
      data: { name: parsed.data.name, role: parsed.data.role, ...(roleChanged ? { sessionVersion: { increment: 1 } } : {}) },
    });
    await logAudit({
      actor: admin,
      action: roleChanged ? "adminUser.role" : "adminUser.update",
      entityType: "AdminUser",
      entityId: id,
      summary: roleChanged
        ? `Changed ${target.email} from ${ROLE_LABELS[target.role]} to ${ROLE_LABELS[parsed.data.role]}`
        : `Updated ${target.email}`,
      changes: { name: { from: target.name, to: parsed.data.name }, role: { from: target.role, to: parsed.data.role } },
    });
    refresh(id);
    return ok(roleChanged ? "Saved — they've been signed out so the new role applies." : "Saved");
  } catch (error) {
    return guardError(error) ?? handleActionError(error);
  }
}

export async function setUserActiveAction(id: string, active: boolean): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.users);
    const target = await db.adminUser.findUniqueOrThrow({ where: { id } });
    await guardUserChange(admin.id, target, { isActive: active });
    await db.adminUser.update({ where: { id }, data: { isActive: active, sessionVersion: { increment: 1 } } });
    await logAudit({
      actor: admin,
      action: active ? "adminUser.reactivate" : "adminUser.deactivate",
      entityType: "AdminUser",
      entityId: id,
      summary: `${active ? "Reactivated" : "Deactivated"} ${target.email}`,
    });
    refresh(id);
    return ok(active ? `${target.email} can sign in again` : `${target.email} has been signed out and can no longer sign in`);
  } catch (error) {
    return guardError(error) ?? handleActionError(error);
  }
}

export async function resetUserPasswordAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState<{ tempPassword?: string }>> {
  try {
    const admin = await assertAdmin(AREA_ROLES.users);
    const parsed = resetPasswordSchema.safeParse({ mode: fdString(fd, "mode") || "generate", password: String(fd.get("password") ?? "") });
    if (!parsed.success) return fromZodError(parsed.error);
    const target = await db.adminUser.findUniqueOrThrow({ where: { id } });
    if (target.id === admin.id) return fail("Change your own password on the My account page.");
    const tempPassword = parsed.data.mode === "generate" ? generateTemporaryPassword() : undefined;
    await db.adminUser.update({
      where: { id },
      data: { passwordHash: await hashPassword(tempPassword ?? parsed.data.password), sessionVersion: { increment: 1 } },
    });
    await logAudit({
      actor: admin,
      action: "adminUser.resetPassword",
      entityType: "AdminUser",
      entityId: id,
      summary: `Reset the password for ${target.email}`,
    });
    refresh(id);
    return ok(`Password reset for ${target.email}. They've been signed out.`, { tempPassword });
  } catch (error) {
    return handleActionError(error);
  }
}
