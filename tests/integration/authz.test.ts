import { describe, expect, it } from "vitest";
import { saveFulfillmentSettings } from "@/app/admin/(dashboard)/delivery/actions";
import { saveSettingsSection } from "@/app/admin/(dashboard)/settings/actions";
import { createUserAction } from "@/app/admin/(dashboard)/users/actions";
import { assertAdmin, AuthorizationError, getCurrentAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formData } from "./d2-helpers";
import { signInAs } from "./helpers";

describe("admin authorization", () => {
  it("rejects unauthenticated callers in server actions", async () => {
    await expect(assertAdmin("EDITOR")).rejects.toBeInstanceOf(AuthorizationError);
    const res = await saveSettingsSection("seo", { ok: false }, formData({ titleSuffix: "X", defaultDescription: "y".repeat(60) }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/session has expired/i);
    expect(await db.siteSetting.count()).toBe(0);
  });

  it("rejects an EDITOR from ADMIN-only settings and delivery actions", async () => {
    await signInAs("EDITOR");
    const settings = await saveSettingsSection("seo", { ok: false }, formData({ titleSuffix: "X", defaultDescription: "y".repeat(60) }));
    expect(settings.ok).toBe(false);
    expect(settings.message).toMatch(/permission/i);
    const delivery = await saveFulfillmentSettings({ ok: false }, formData({ deliveryEnabled: true, noDeliveryAreasMessage: "Message us please", leadTimeDays: 1 }));
    expect(delivery.ok).toBe(false);
    expect(await db.siteSetting.count()).toBe(0);
  });

  it("rejects an ADMIN from OWNER-only user management", async () => {
    await signInAs("ADMIN");
    const res = await createUserAction({ ok: false }, formData({ name: "New Person", email: "new@mcpreps.test", role: "OWNER", passwordMode: "generate" }));
    expect(res.ok).toBe(false);
    expect(await db.adminUser.count({ where: { email: "new@mcpreps.test" } })).toBe(0);
  });

  it("treats a deactivated account's session as signed out", async () => {
    const admin = await signInAs("ADMIN");
    expect(await getCurrentAdmin()).not.toBeNull();
    await db.adminUser.update({ where: { id: admin.id }, data: { isActive: false } });
    expect(await getCurrentAdmin()).toBeNull();
    await expect(assertAdmin("EDITOR")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("invalidates existing sessions when the session version changes", async () => {
    const admin = await signInAs("OWNER");
    expect((await getCurrentAdmin())?.id).toBe(admin.id);
    await db.adminUser.update({ where: { id: admin.id }, data: { sessionVersion: { increment: 1 } } });
    expect(await getCurrentAdmin()).toBeNull();
  });
});
