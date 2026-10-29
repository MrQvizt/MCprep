const BASE = "https://same-site.invalid";

/**
 * Only allow redirects to paths on this site. Parsing the way a browser
 * does catches tricks like "//evil.com", "/\\evil.com" and "/\t/evil.com"
 * (browsers drop tabs and newlines, which turns the last one into "//evil.com").
 */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.length > 300) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE || url.pathname.startsWith("//")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
