import "server-only";
import { env } from "@/lib/env";

/** Verify a Cloudflare Turnstile token. Returns true when Turnstile isn't configured. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch (error) {
    console.error("[turnstile] verification failed", error);
    return false;
  }
}
