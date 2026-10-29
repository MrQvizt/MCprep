import { describe, expect, it } from "vitest";
import { saveSettingsSection } from "@/app/admin/(dashboard)/settings/actions";
import { db } from "@/lib/db";
import { formData } from "./d2-helpers";
import { signInAs } from "./helpers";

describe("activity log", () => {
  it("records who changed a setting, with before/after values", async () => {
    const admin = await signInAs("ADMIN");
    const res = await saveSettingsSection("seo", { ok: false }, formData({ titleSuffix: "MC PREPS Malta", defaultDescription: "Fresh macro-tracked meal prep in Malta with collection and delivery options." }));
    expect(res.ok).toBe(true);
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "settings.seo" } });
    expect(entry.actorId).toBe(admin.id);
    expect(entry.actorEmail).toBe(admin.email);
    expect(entry.summary).toMatch(/search defaults/i);
    const changes = entry.changes as Record<string, { from: unknown; to: unknown }>;
    expect(changes.defaultDescription.to).toMatch(/Fresh macro-tracked/);
  });
});
