import { expect, type Page } from "@playwright/test";

export const E2E_ADMIN = { email: "owner@e2e.test", password: "E2E-Owner-Password-1" };

export async function adminLogin(page: Page, next = "/admin") {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.locator("#email").fill(E2E_ADMIN.email);
  await page.locator("#password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 20_000 });
}

/** All text inside <h1> elements of raw HTML. */
export function h1Texts(html: string): string[] {
  return [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export function metaContent(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]*content="([^"]*)"`, "i");
  return re.exec(html)?.[1] ?? null;
}

export function canonical(html: string): string | null {
  return /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html)?.[1] ?? null;
}
