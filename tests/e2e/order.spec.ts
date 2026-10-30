import { expect, test } from "@playwright/test";
import { adminLogin } from "./helpers";

/**
 * Critical customer journey (runs on desktop and on a mobile viewport):
 * choose a package → build it → choose dishes → claim the first-week offer → submit → confirmation.
 */
test.describe("order request journey", () => {
  test("build a package, choose dishes and submit an order request", async ({ page }) => {
    await page.goto("/plans");
    const choose = page.locator('a[data-plan="lunch-dinner-5-days"]').first();
    await expect(choose).toBeVisible();
    await choose.click();

    await expect(page).toHaveURL(/\/order\?plan=lunch-dinner-5-days/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/build your package/i);
    const summary = page.locator("#order-summary");
    await expect(summary).toContainText("Lunch + Dinner · 5 days");
    await expect(summary).toContainText("10 meals a week");

    // Switching to 7 days and back keeps the dish choices in step with the package.
    await page.locator("label").filter({ hasText: /^7 days/ }).first().click();
    await expect(summary).toContainText("Lunch + Dinner · 7 days");
    await page.locator("label").filter({ hasText: /^5 days/ }).first().click();
    await expect(page.getByText("meals chosen")).toContainText("10");

    // Dish choices must add up to the package.
    await page.getByRole("button", { name: "Clear" }).click();
    for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "One more Chicken Poke Bowl" }).click();
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "One more Biscoff Cheesecake" }).click();
    await expect(summary).toContainText("6× Chicken Poke Bowl");
    await expect(summary).toContainText("4× Biscoff Cheesecake");

    await page.getByRole("textbox", { name: "Full name" }).fill("E2E Customer");
    await page.getByRole("textbox", { name: "Email" }).fill(`e2e.${Date.now()}@example.com`);
    await page.getByRole("textbox", { name: "Phone" }).fill("7900 1234");

    // Only enabled localities are offered for delivery.
    await page.locator("label").filter({ hasText: /^Delivery/ }).first().click();
    const locality = page.getByLabel("Locality");
    const options = await locality.locator("option").allTextContents();
    expect(options).toContain("Sliema");
    expect(options).not.toContain("Valletta"); // seeded but not confirmed by the business
    await locality.selectOption({ label: "Sliema" });
    await page.getByRole("textbox", { name: "Address" }).fill("1, Triq it-Torri");

    // First-week offer: €6 a meal with a personal countdown, once the first-order box is ticked.
    await expect(page.getByText("Your first week: €6 a meal").first()).toBeVisible();
    await expect(page.getByRole("timer").first()).toBeVisible();
    const total = summary.locator("p.font-display").first();
    await expect(total).toHaveText("€95");
    await page.getByText("I confirm this is my first order").click();
    await expect(total).toHaveText("€60", { timeout: 10_000 });
    await expect(page.getByText("Requested — subject to verification").first()).toBeVisible();

    await page.getByText("I've read the").click();
    await page.waitForTimeout(2200); // humans take a moment; the server rejects instant bot submissions
    await page.getByRole("button", { name: "Send order request" }).click();

    await expect(page).toHaveURL(/\/order\/confirmation\?ref=MCP-\d{6}&t=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Thanks, E2E.");
    await expect(page.getByText("No payment has been taken").first()).toBeVisible();
    await expect(page.locator("main")).toContainText("6× Chicken Poke Bowl");
    // Private details are not shown on the confirmation page.
    await expect(page.getByText("Triq it-Torri")).toHaveCount(0);
    const reference = /ref=(MCP-\d{6})/.exec(page.url())![1];

    // The order is waiting in the admin with its dishes, and the first-order check flagged for review.
    await adminLogin(page, "/admin/orders");
    const row = page.getByText(reference).filter({ visible: true }).first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.locator("main")).toContainText("E2E Customer");
    await expect(page.locator("main")).toContainText("Dishes per week");
    await expect(page.locator("main")).toContainText("Biscoff Cheesecake");
    await expect(page.locator("main")).toContainText(/New customer \(preliminary\)|eligib/i);
  });

  test("shows clear validation errors and keeps what was typed", async ({ page }) => {
    await page.goto("/order?plan=lunch-5-days");
    await page.getByRole("textbox", { name: "Full name" }).fill("A");
    await page.getByRole("button", { name: "Send order request" }).click();
    await expect(page.getByText("Enter your full name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Please confirm you've read the privacy notice.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("A");
  });

  test("won't send a package whose dishes don't add up", async ({ page }) => {
    await page.goto("/order?plan=lunch-5-days");
    await page.getByRole("button", { name: "Clear" }).click();
    await page.getByRole("button", { name: "One more Mexican Beef Bowl" }).click();
    await page.getByRole("textbox", { name: "Full name" }).fill("E2E Customer");
    await page.getByRole("textbox", { name: "Email" }).fill("e2e.dishes@example.com");
    await page.getByRole("textbox", { name: "Phone" }).fill("7900 1234");
    await page.locator("label").filter({ hasText: /^Collection/ }).first().click();
    await page.getByText("I've read the").click();
    await page.getByRole("button", { name: "Send order request" }).click();
    await expect(page.getByText("Add 4 more meals").first()).toBeVisible();
    await expect(page).toHaveURL(/\/order\?plan=lunch-5-days/);
  });
});
