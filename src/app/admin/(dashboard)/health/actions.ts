"use server";

import { revalidatePath } from "next/cache";
import { handleActionError, ok, type ActionState } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { runSiteHealthCheck } from "@/lib/site-health";

export async function runHealthCheckNow(): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.health);
    const limited = await rateLimit(`health-check:${admin.id}`, 10, 10 * 60);
    if (!limited.ok) return { ok: false, message: "Please wait a few minutes before running the check again.", ts: Date.now() };
    const result = await runSiteHealthCheck("manual");
    await logAudit({ actor: admin, action: "health.run", entityType: "SiteHealthCheck", entityId: result.id, summary: `Ran site health check (${result.issueCount} items)` });
    revalidatePath("/admin/health");
    return ok(result.issueCount === 0 ? "All checks passed" : `Check finished — ${result.issueCount} item${result.issueCount === 1 ? "" : "s"} to look at`);
  } catch (error) {
    return handleActionError(error);
  }
}
