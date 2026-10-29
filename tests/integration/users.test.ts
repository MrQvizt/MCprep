import { describe, expect, it } from "vitest";
import {
  createUserAction,
  resetUserPasswordAction,
  setUserActiveAction,
  updateUserAction,
} from "@/app/admin/(dashboard)/users/actions";
import { generateTemporaryPassword, guardUserChange, UserGuardError } from "@/lib/admin/users";
import { db } from "@/lib/db";
import { passwordProblem, verifyPassword } from "@/lib/passwords";
import { formData } from "./d2-helpers";
import { createAdmin, signInAs } from "./helpers";

describe("admin user management", () => {
  it("generates strong temporary passwords", () => {
    for (let i = 0; i < 20; i++) expect(passwordProblem(generateTemporaryPassword())).toBeNull();
  });

  it("creates a user with a generated password shown once", async () => {
    await signInAs("OWNER");
    const res = await createUserAction(
      { ok: false },
      formData({ name: "Kitchen Editor", email: "Editor@MCPREPS.test", role: "EDITOR", passwordMode: "generate" }),
    );
    expect(res.ok).toBe(true);
    const temp = res.data?.tempPassword;
    expect(temp).toBeTruthy();
    const user = await db.adminUser.findUniqueOrThrow({ where: { email: "editor@mcpreps.test" } });
    expect(user.role).toBe("EDITOR");
    expect(await verifyPassword(temp!, user.passwordHash)).toBe(true);
    expect(user.passwordHash).not.toContain(temp!);
    expect(await db.auditLog.count({ where: { action: "adminUser.create", entityId: user.id } })).toBe(1);
  });

  it("rejects weak chosen passwords and duplicate emails", async () => {
    await signInAs("OWNER");
    const weak = await createUserAction({ ok: false }, formData({ name: "A Person", email: "a@mcpreps.test", role: "ADMIN", passwordMode: "set", password: "short" }));
    expect(weak.ok).toBe(false);
    expect(weak.fieldErrors?.password).toBeTruthy();
    await createAdmin("ADMIN", "dupe@mcpreps.test");
    const dupe = await createUserAction({ ok: false }, formData({ name: "Dupe", email: "dupe@mcpreps.test", role: "ADMIN", passwordMode: "generate" }));
    expect(dupe.ok).toBe(false);
    expect(dupe.message).toMatch(/already in use/i);
  });

  it("prevents you from deactivating or demoting yourself", async () => {
    const me = await signInAs("OWNER");
    const deactivate = await setUserActiveAction(me.id, false);
    expect(deactivate.ok).toBe(false);
    expect(deactivate.message).toMatch(/your own account/i);
    const demote = await updateUserAction(me.id, { ok: false }, formData({ name: me.name, role: "ADMIN" }));
    expect(demote.ok).toBe(false);
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: me.id } })).role).toBe("OWNER");
  });

  it("always keeps at least one active owner", async () => {
    const onlyOwner = await createAdmin("OWNER", "only-owner@mcpreps.test");
    await expect(guardUserChange("someone-else", onlyOwner, { isActive: false })).rejects.toBeInstanceOf(UserGuardError);
    await expect(guardUserChange("someone-else", onlyOwner, { role: "ADMIN" })).rejects.toBeInstanceOf(UserGuardError);
    await createAdmin("OWNER", "second-owner@mcpreps.test");
    await expect(guardUserChange("someone-else", onlyOwner, { role: "ADMIN" })).resolves.toBeUndefined();
  });

  it("signs a user out when they are deactivated, their role changes or their password is reset", async () => {
    await signInAs("OWNER");
    const target = await createAdmin("ADMIN", "staff@mcpreps.test");

    expect((await updateUserAction(target.id, { ok: false }, formData({ name: "Staff", role: "EDITOR" }))).ok).toBe(true);
    let row = await db.adminUser.findUniqueOrThrow({ where: { id: target.id } });
    expect(row.role).toBe("EDITOR");
    expect(row.sessionVersion).toBe(target.sessionVersion + 1);

    const reset = await resetUserPasswordAction(target.id, { ok: false }, formData({ mode: "generate" }));
    expect(reset.ok).toBe(true);
    row = await db.adminUser.findUniqueOrThrow({ where: { id: target.id } });
    expect(row.sessionVersion).toBe(target.sessionVersion + 2);
    expect(await verifyPassword(reset.data!.tempPassword!, row.passwordHash)).toBe(true);

    expect((await setUserActiveAction(target.id, false)).ok).toBe(true);
    row = await db.adminUser.findUniqueOrThrow({ where: { id: target.id } });
    expect(row.isActive).toBe(false);
    expect(row.sessionVersion).toBe(target.sessionVersion + 3);
  });
});
