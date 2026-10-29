/** Only allow http(s) Instagram URLs (instagram.com / instagr.am). */
export function isInstagramUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am";
  } catch {
    return false;
  }
}

/** Safe external URL (http/https only). */
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Internal path: starts with a single "/" and contains no scheme or backslashes. */
export function isSafeInternalPath(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\/(?!\/)[^\s\\]*$/.test(value);
}

/** Link target for CTA buttons: internal path or http(s) URL only. */
export function isSafeHref(value: string | null | undefined): boolean {
  return isSafeInternalPath(value) || isSafeHttpUrl(value);
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ħ/gi, "h")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normalise a path for redirect matching: leading slash, no trailing slash, lower-case. */
export function normalizePath(path: string): string {
  let p = path.trim();
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {
    /* ignore */
  }
  p = p.split("?")[0].split("#")[0];
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p.toLowerCase();
}
