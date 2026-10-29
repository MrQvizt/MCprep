import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export interface AuditActor {
  id: string;
  email: string;
}

/** Record an administrative change. Never throws (auditing must not block the action). */
export async function logAudit(entry: {
  actor: AuditActor | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  changes?: Prisma.InputJsonValue;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actor?.id ?? null,
        actorEmail: entry.actor?.email ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary.slice(0, 500),
        changes: entry.changes,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit log", error);
  }
}

/** Shallow diff of two plain objects for audit logs (values truncated). */
export function diffObjects(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      const trim = (v: unknown) => (typeof v === "string" && v.length > 200 ? `${v.slice(0, 200)}…` : v);
      changes[key] = { from: trim(a), to: trim(b) };
    }
  }
  return changes;
}
