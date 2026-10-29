import { expect, test } from "@playwright/test";
import { adminLogin } from "./helpers";

test.describe("admin portal", () => {
  test("owner can change a plan price and the public site updates", async ({ page }) => {
    await adminLogin(page, "/admin/plans");
    await expect(page).toHaveURL(/\/admin\/plans/);
    await page.getByRole("link", { name: "Lunch · 5 days" }).first().click();
    await expect(page).toHaveURL(/\/admin\/plans\/[^/]+$/);
    const price = page.locator('input[name="price"]');
    await price.fill("55.00");
    await page.getByRole("button", { name: "Save plan" }).click();
    await expect(page.getByText(/saved|updated/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/plans");
    await expect(page.locator('article[aria-label="Lunch · 5 days"]').first()).toContainText("€55 a week");
  });

  test("owner can edit a page's Google title", async ({ page, request }) => {
    await adminLogin(page, "/admin/seo/about");
    const title = page.getByLabel("Google title");
    await title.fill("About MC PREPS | E2E Title Check");
    await page.getByRole("button", { name: /save/i }).first().click();
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 15_000 });
    const html = await (await request.get("/about")).text();
    expect(html).toContain("<title>About MC PREPS | E2E Title Check</title>");
  });

  test("promotions and admin sections load for the owner", async ({ page }) => {
    await adminLogin(page);
    for (const [path, text] of [
      ["/admin", /dashboard|welcome|orders/i],
      ["/admin/promotions", /Halloween/],
      ["/admin/meals", /Chicken Poke Bowl/],
      ["/admin/delivery", /Sliema/],
      ["/admin/seo", /Meal Prep Malta/],
      ["/admin/blog", /Meal Prep in Malta/],
      ["/admin/launch", /launch/i],
      ["/admin/growth", /order requests/i],
      ["/admin/settings", /business/i],
      ["/admin/users", /owner@e2e\.test/],
    ] as const) {
      await page.goto(path);
      await expect(page.locator("main")).toContainText(text);
    }
  });
});
