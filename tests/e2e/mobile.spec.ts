import { expect, test } from "@playwright/test";

test.describe("mobile usability", () => {
  test("no horizontal scrolling on key pages", async ({ page }) => {
    for (const path of ["/", "/plans", "/menu", "/order?plan=2-weeks", "/meal-prep-malta", "/offers/halloween"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });

  test("mobile navigation opens and navigates", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /open menu/i }).click();
    const nav = page.getByRole("dialog").or(page.locator("#mobile-nav"));
    await expect(nav.getByRole("link", { name: /plans/i }).first()).toBeVisible();
    await nav.getByRole("link", { name: /plans/i }).first().click();
    await expect(page).toHaveURL(/\/plans/);
  });

  test("pricing cards are readable and tappable", async ({ page }) => {
    await page.goto("/plans");
    const cta = page.locator('a[data-plan="1-week"]').first();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44); // touch target
    await cta.click();
    await expect(page).toHaveURL(/\/order\?plan=1-week/);
    await expect(page.getByRole("button", { name: "Send order request" })).toBeVisible();
  });
});
