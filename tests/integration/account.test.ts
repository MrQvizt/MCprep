import { describe, expect, it } from "vitest";
import { changePasswordAction, updateProfileAction } from "@/app/admin/(dashboard)/account/actions";
import { getCurrentAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";
import { formData } from "./d2-helpers";
import { signInAs } from "./helpers";

const CURRENT = "Test-Password-123"; // set by createAdmin()

describe("my account", () => {
  it("requires the current password to change your password", async () => {
    const me = await signInAs("EDITOR");
    const wrong = await changePasswordAction(
      { ok: false },
      formData({ currentPassword: "not-my-password", newPassword: "Brand-New-Pass-42", confirmPassword: "Brand-New-Pass-42" }),
    );
    expect(wrong.ok).toBe(false);
    expect(wrong.fieldErrors?.currentPassword).toMatch(/incorrect/i);
    const row = await db.adminUser.findUniqueOrThrow({ where: { id: me.id } });
    expect(await verifyPassword(CURRENT, row.passwordHash)).toBe(true);
    expect(row.sessionVersion).toBe(me.sessionVersion);
  });

  it("validates the new password and confirmation", async () => {
    await signInAs("EDITOR");
    const mismatch = await changePasswordAction(
      { ok: false },
      formData({ currentPassword: CURRENT, newPassword: "Brand-New-Pass-42", confirmPassword: "Brand-New-Pass-43" }),
    );
    expect(mismatch.fieldErrors?.confirmPassword).toBeTruthy();
    const weak = await changePasswordAction({ ok: false }, formData({ currentPassword: CURRENT, newPassword: "short", confirmPassword: "short" }));
    expect(weak.fieldErrors?.newPassword).toBeTruthy();
  });

  it("changes the password and signs out every session", async () => {
    const me = await signInAs("ADMIN");
    const res = await changePasswordAction(
      { ok: false },
      formData({ currentPassword: CURRENT, newPassword: "Brand-New-Pass-42", confirmPassword: "Brand-New-Pass-42" }),
    );
    expect(res.ok).toBe(true);
    expect(res.data?.signedOut).toBe(true);
    const row = await db.adminUser.findUniqueOrThrow({ where: { id: me.id } });
    expect(await verifyPassword("Brand-New-Pass-42", row.passwordHash)).toBe(true);
    expect(row.sessionVersion).toBe(me.sessionVersion + 1);
    expect(await getCurrentAdmin()).toBeNull();
    expect(await db.auditLog.count({ where: { action: "account.password", entityId: me.id } })).toBe(1);
  });

  it("requires the current password to change your sign-in email", async () => {
    const me = await signInAs("ADMIN");
    const noPw = await updateProfileAction({ ok: false }, formData({ name: "Renamed", email: "new-address@mcpreps.test" }));
    expect(noPw.ok).toBe(false);
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: me.id } })).email).toBe(me.email);

    const nameOnly = await updateProfileAction({ ok: false }, formData({ name: "Renamed", email: me.email }));
    expect(nameOnly.ok).toBe(true);

    const withPw = await updateProfileAction({ ok: false }, formData({ name: "Renamed", email: "new-address@mcpreps.test", currentPassword: CURRENT }));
    expect(withPw.ok).toBe(true);
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: me.id } })).email).toBe("new-address@mcpreps.test");
  });
});
