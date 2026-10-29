import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Best-effort client IP from proxy headers (Vercel / reverse proxies). */
export function clientIpFrom(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

/** One-way hash so raw IP addresses are never stored. */
export function hashValue(value: string): string {
  const salt = process.env.HASH_SALT || process.env.AUTH_SECRET || "mcpreps";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 40);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function deviceFromUserAgent(ua: string | null): "mobile" | "tablet" | "desktop" {
  const s = (ua ?? "").toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/mobi|iphone|android/.test(s)) return "mobile";
  return "desktop";
}

export function isBotUserAgent(ua: string | null): boolean {
  return /bot|crawler|spider|crawling|preview|headless|lighthouse|facebookexternalhit|whatsapp|slurp/i.test(ua ?? "");
}
