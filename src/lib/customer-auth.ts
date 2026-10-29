import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/**
 * Customer portal sessions. The cookie holds a random token; only its SHA-256
 * hash is stored. Sessions expire after SESSION_DAYS and are revoked when the
 * account's sessionVersion changes (password change, "sign out everywhere").
 */

export const CUSTOMER_COOKIE = "mc_session";
export const SESSION_DAYS = 60;
const SESSION_MS = SESSION_DAYS * 86_400_000;
const TOUCH_INTERVAL_MS = 15 * 60_000;

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export interface CurrentCustomer {
  id: string;
  email: string;
  name: string;
  firstName: string;
  phone: string | null;
  currentStreak: number;
  longestStreak: number;
  /** YYYY-MM-DD (Malta calendar) */
  lastCheckInDay: string | null;
  pointsBalance: number;
  createdAt: Date;
}

const toDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** The signed-in customer for this request, or null. Never throws (public pages must keep working). */
export const getCurrentCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  let token: string | undefined;
  try {
    token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!token || token.length < 32 || token.length > 128) return null;
  try {
    const session = await db.customerSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { account: true } });
    if (!session) return null;
    const now = Date.now();
    if (session.expiresAt.getTime() <= now || session.sessionVersion !== session.account.sessionVersion) return null;
    if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await db.customerSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
    }
    const a = session.account;
    return {
      id: a.id,
      email: a.email,
      name: a.name,
      firstName: a.name.split(/\s+/)[0] || a.name,
      phone: a.phone,
      currentStreak: a.currentStreak,
      longestStreak: a.longestStreak,
      lastCheckInDay: toDay(a.lastCheckInDay),
      pointsBalance: a.pointsBalance,
      createdAt: a.createdAt,
    };
  } catch (error) {
    console.error("[account] could not read session", error);
    return null;
  }
});

/** For portal pages: redirects to sign-in when signed out. */
export async function requireCustomer(next = "/account"): Promise<CurrentCustomer> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect(`/account/sign-in?next=${encodeURIComponent(next)}`);
  return customer;
}

/** Start a session for the account (Server Functions only — sets the cookie). */
export async function startCustomerSession(account: { id: string; sessionVersion: number }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await db.customerSession.create({
    data: { accountId: account.id, tokenHash: tokenHash(token), sessionVersion: account.sessionVersion, expiresAt },
  });
  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_MS / 1000),
  });
}

/** End this device's session (Server Functions only). */
export async function endCustomerSession() {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (token) await db.customerSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  store.delete(CUSTOMER_COOKIE);
}

/** Only allow redirects to paths on this site. */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next.slice(0, 300);
}
