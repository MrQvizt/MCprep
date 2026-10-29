import { expect, test } from "@playwright/test";

/**
 * Critical customer journey (runs on desktop and on a mobile viewport):
 * choose a plan on the pricing page → order form pre-selected → submit → confirmation.
 */
test.describe("order request journey", () => {
  test("choose a plan and submit an order request", async ({ page }) => {
    await page.goto("/plans");
    const choose = page.locator('a[data-plan="2-weeks"]').first();
    await expect(choose).toBeVisible();
    await choose.click();

    await expect(page).toHaveURL(/\/order\?plan=2-weeks/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/request your plan/i);
    // Plan is pre-selected and priced by the server.
    await expect(page.locator('input[name="planSlug"][value="2-weeks"]')).toBeChecked();
    await expect(page.getByText("No payment is required now.", { exact: false }).first()).toBeVisible();

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

    // First-order offer: requesting it lowers the estimated total.
    const totalLocator = page.locator('[aria-live="polite"] p.font-display');
    const before = await totalLocator.textContent();
    await page.getByText("I confirm this is my first order").click();
    await expect(totalLocator).not.toHaveText(before ?? "", { timeout: 10_000 });
    await expect(page.getByText("Requested — subject to verification").first()).toBeVisible();

    await page.getByText("I've read the").click();
    await page.waitForTimeout(2200); // humans take a moment; the server rejects instant bot submissions
    await page.getByRole("button", { name: "Send order request" }).click();

    await expect(page).toHaveURL(/\/order\/confirmation\?ref=MCP-\d{6}&t=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Thanks, E2E.");
    await expect(page.getByText("No payment has been taken").first()).toBeVisible();
    // Private details are not shown on the confirmation page.
    await expect(page.getByText("Triq it-Torri")).toHaveCount(0);
  });

  test("shows clear validation errors and keeps what was typed", async ({ page }) => {
    await page.goto("/order?plan=1-week");
    await page.getByRole("textbox", { name: "Full name" }).fill("A");
    await page.getByRole("button", { name: "Send order request" }).click();
    await expect(page.getByText("Enter your full name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Please confirm you've read the privacy notice.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("A");
  });
});
