import { db } from "@/lib/db";
import { normalizePath } from "@/lib/urls";

export { checkRedirect, REDIRECT_PROBLEM_MESSAGES, type RedirectProblem } from "@/lib/redirect-rules";

export interface RedirectTarget {
  id: string;
  toPath: string;
  statusCode: number;
}

const TTL_MS = 30_000;
let cached: { at: number; map: Map<string, RedirectTarget> } | null = null;

async function loadRedirects(): Promise<Map<string, RedirectTarget>> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.map;
  const rows = await db.redirectRule.findMany({
    where: { isActive: true },
    select: { id: true, fromPath: true, toPath: true, statusCode: true },
  });
  const map = new Map(rows.map((r) => [normalizePath(r.fromPath), { id: r.id, toPath: r.toPath, statusCode: r.statusCode }]));
  cached = { at: Date.now(), map };
  return map;
}

export function clearRedirectCache() {
  cached = null;
}

export async function findRedirect(pathname: string): Promise<RedirectTarget | null> {
  try {
    const map = await loadRedirects();
    if (map.size === 0) return null;
    return map.get(normalizePath(pathname)) ?? null;
  } catch {
    return null; // fail open — never block the site because of redirects
  }
}

export async function recordRedirectHit(id: string) {
  try {
    await db.redirectRule.update({ where: { id }, data: { hits: { increment: 1 }, lastHitAt: new Date() } });
  } catch {
    /* ignore */
  }
}

/**
 * Create or update a 301 redirect when a published page's address changes.
 * Existing rules that pointed at the old address are re-pointed to avoid chains.
 */
export async function createSlugChangeRedirect(oldPath: string, newPath: string, note: string) {
  const from = normalizePath(oldPath);
  const to = normalizePath(newPath);
  if (from === to) return null;
  await db.$transaction(async (tx) => {
    // Remove a rule that would now redirect the new address away (rename back-and-forth).
    await tx.redirectRule.deleteMany({ where: { fromPath: to } });
    // Collapse chains: anything that pointed at the old path now points at the new one.
    await tx.redirectRule.updateMany({ where: { toPath: from }, data: { toPath: to } });
    await tx.redirectRule.upsert({
      where: { fromPath: from },
      create: { fromPath: from, toPath: to, statusCode: 301, note },
      update: { toPath: to, statusCode: 301, isActive: true, note },
    });
  });
  clearRedirectCache();
  return { from, to };
}
