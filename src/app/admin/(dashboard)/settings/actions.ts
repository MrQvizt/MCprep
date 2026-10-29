"use server";

import { revalidatePath } from "next/cache";
import { fail, fromZodError, handleActionError, ok, type ActionState } from "@/lib/actions";
import { isSettingsSection, SETTINGS_SECTIONS, type SettingsSection } from "@/lib/admin/settings-forms";
import { sendTestEmail } from "@/lib/admin/test-email";
import { diffObjects, logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { revalidatePublicSite } from "@/lib/revalidate";
import { parseSettings, updateSettingsGroup, type SettingsGroup } from "@/lib/settings";

export async function saveSettingsSection(section: SettingsSection, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.settings);
    if (!isSettingsSection(section)) return fail("Unknown settings section.");
    const def = SETTINGS_SECTIONS[section];
    const parsed = def.schema.safeParse(def.values(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    const patch = parsed.data as Record<string, unknown>;

    if (section === "branding") {
      const ids = ["logoMediaId", "logoAltMediaId", "faviconMediaId", "socialShareMediaId"]
        .map((k) => patch[k])
        .filter((v): v is string => typeof v === "string");
      if (ids.length > 0) {
        const found = await db.mediaAsset.count({ where: { id: { in: ids } } });
        if (found !== new Set(ids).size) return fail("One of the chosen images no longer exists. Please choose it again.");
      }
    }

    const group = def.group as SettingsGroup;
    const before = parseSettings(group, (await db.siteSetting.findUnique({ where: { key: group } }))?.value);
    const after = await updateSettingsGroup(group, patch as never, admin.id);
    await logAudit({
      actor: admin,
      action: `settings.${group}`,
      entityType: "SiteSetting",
      entityId: group,
      summary: `Updated ${def.label.toLowerCase()}`,
      changes: diffObjects(before as Record<string, unknown>, after as Record<string, unknown>) as object,
    });
    revalidatePath("/admin/settings");
    revalidatePublicSite();
    return ok(`${def.label} saved`);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function sendTestEmailAction(): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.settings);
    const res = await sendTestEmail(admin);
    revalidatePath("/admin/settings");
    if (res.errors.includes("NO_RECIPIENTS")) {
      return fail("Add an order notification email (Contact & social) first.");
    }
    if (res.result.skipped === "disabled") {
      return fail("The test email is queued, but no email provider is configured yet. Ask your developer to add the Resend API key.");
    }
    if (res.result.sent > 0 && res.errors.length === 0) {
      return ok(`Test email sent to ${res.recipients.join(", ")}. Check the inbox (and spam folder).`);
    }
    return fail(`The test email couldn't be sent: ${res.errors[0] ?? "unknown error"}. It will be retried automatically.`);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function retryEmailAction(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.settings);
    const { requeueEmail, processOutbox } = await import("@/lib/email/outbox");
    await requeueEmail(id);
    const result = await processOutbox({ ids: [id] });
    await logAudit({ actor: admin, action: "email.retry", entityType: "EmailOutbox", entityId: id, summary: "Retried a failed email" });
    revalidatePath("/admin/settings");
    if (result.skipped === "disabled") return fail("No email provider is configured, so the email stays queued.");
    return result.sent > 0 ? ok("Email sent") : fail("Still failing — it will be retried automatically.");
  } catch (error) {
    return handleActionError(error);
  }
}
