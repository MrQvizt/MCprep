import { RESERVED_PATH_PREFIXES } from "@/lib/seo/pages";
import { normalizePath } from "@/lib/urls";

/** Pure redirect validation (no database access). */
export type RedirectProblem =
  | "SAME_PATH"
  | "RESERVED_SOURCE"
  | "INVALID_SOURCE"
  | "INVALID_TARGET"
  | "LOOP"
  | "CHAIN";

/**
 * Validate a redirect against existing rules. Loops are errors; chains
 * (A → B where B also redirects) are reported so the owner can point A
 * straight at the final destination.
 */
export function checkRedirect(
  rule: { fromPath: string; toPath: string },
  existing: { fromPath: string; toPath: string; isActive?: boolean }[],
): RedirectProblem | null {
  const from = normalizePath(rule.fromPath);
  const toIsExternal = /^https?:\/\//i.test(rule.toPath);
  if (!/^\/[a-z0-9\-._~%!$&'()*+,;=:@/]*$/i.test(rule.fromPath.trim())) return "INVALID_SOURCE";
  if (RESERVED_PATH_PREFIXES.some((p) => from === p || from.startsWith(`${p}/`))) return "RESERVED_SOURCE";
  if (!toIsExternal && !/^\/[^\s\\]*$/.test(rule.toPath.trim())) return "INVALID_TARGET";
  if (toIsExternal) {
    try {
      const u = new URL(rule.toPath);
      if (u.protocol !== "https:" && u.protocol !== "http:") return "INVALID_TARGET";
    } catch {
      return "INVALID_TARGET";
    }
    return null;
  }
  const to = normalizePath(rule.toPath);
  if (from === to) return "SAME_PATH";

  const graph = new Map<string, string>();
  for (const r of existing) {
    if (r.isActive === false) continue;
    if (/^https?:\/\//i.test(r.toPath)) continue;
    graph.set(normalizePath(r.fromPath), normalizePath(r.toPath));
  }
  graph.set(from, to);

  // Follow the chain from the new rule's source.
  const seen = new Set<string>([from]);
  let current = to;
  let hops = 0;
  while (graph.has(current)) {
    if (seen.has(current)) return "LOOP";
    seen.add(current);
    current = graph.get(current)!;
    hops++;
    if (hops > 20) return "LOOP";
  }
  if (seen.has(current)) return "LOOP";
  // Is anything pointing at our source (making a chain into this rule) or do we point at a redirect?
  if (hops > 0) return "CHAIN";
  return null;
}

export const REDIRECT_PROBLEM_MESSAGES: Record<RedirectProblem, string> = {
  SAME_PATH: "The old and new addresses are the same.",
  RESERVED_SOURCE: "This address is reserved by the website and can't be redirected.",
  INVALID_SOURCE: "The old address must start with “/”, for example /old-page.",
  INVALID_TARGET: "The new address must start with “/” (e.g. /menu) or be a full https:// link.",
  LOOP: "This would create a redirect loop — visitors would bounce between pages forever.",
  CHAIN: "The new address itself redirects somewhere else. Point straight at the final page instead.",
};

