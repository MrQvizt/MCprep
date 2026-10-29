import { expect, test, type Page } from "@playwright/test";
import { adminLogin } from "./helpers";

const PASSWORD = "Meal-prep-2026";

/** Quick order (collection, default dish split) → the order reference. */
async function placeGuestOrder(page: Page, email: string, name = "Portal Tester") {
  await page.goto("/order?plan=lunch-5-days");
  await page.getByRole("textbox", { name: "Full name" }).fill(name);
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Phone" }).fill("7900 4321");
  await page.locator("label").filter({ hasText: /^Collection/ }).first().click();
  await page.getByText("I've read the").click();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: "Send order request" }).click();
  await expect(page).toHaveURL(/\/order\/confirmation\?ref=MCP-\d{6}&t=/, { timeout: 30_000 });
  return /ref=(MCP-\d{6})/.exec(page.url())![1];
}

test.describe("customer account", () => {
  test("save an order to a new account, then order the same package again", async ({ page }) => {
    const email = `portal.${Date.now()}@example.com`;
    const reference = await placeGuestOrder(page, email);

    // Confirmation page offers an account; sign-up is pre-filled from the order.
    await page.getByRole("link", { name: "Create my account" }).click();
    await expect(page).toHaveURL(/\/account\/sign-up\?ref=/);
    await expect(page.getByLabel("Your name")).toHaveValue("Portal Tester");
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    // Dashboard: the order is saved, with an "order again" shortcut.
    await expect(page).toHaveURL(/\/account\?welcome=1/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Portal");
    await expect(page.getByText(reference)).toBeVisible();
    await expect(page.getByText("Request received").first()).toBeVisible();
    await expect(page.getByText("Not paid yet").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Portal/ }).first()).toBeVisible(); // header shows who's signed in

    await page.getByRole("link", { name: "Order this again" }).click();
    await expect(page).toHaveURL(/\/order\?plan=lunch-5-days&dishes=/);
    await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue("Portal Tester");
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(email);
    await expect(page.getByText("Signed in as")).toBeVisible();

    // Sign out, then back in (wrong password first).
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/sign-in\?next=%2Faccount/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Wrong-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That email and password don't match.")).toBeVisible();
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 20_000 });
    await expect(page.getByText(reference)).toBeVisible();
  });

  test("the team can send a password link, and the customer can delete their account", async ({ page, browser }) => {
    const email = `reset.${Date.now()}@example.com`;
    await page.goto("/account/sign-up");
    await page.getByLabel("Your name").fill("Reset Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/account\?welcome=1/, { timeout: 20_000 });

    // Orders placed while signed in go straight into the account.
    const reference = await placeGuestOrder(page, email, "Reset Tester");
    await expect(page.getByText("Saved to")).toBeVisible();
    await page.goto("/account");
    await expect(page.getByText(reference)).toBeVisible();

    // Forgot-password never reveals whether an account exists.
    const guest = await browser.newContext();
    const other = await guest.newPage();
    await other.goto("/account/forgot-password");
    await other.getByLabel("Email").fill("nobody.here@example.com");
    await other.getByRole("button", { name: "Send reset link" }).click();
    await expect(other.getByText("If there's an account for that email")).toBeVisible();

    // Admin creates a one-time link from the customer page.
    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();
    await adminLogin(admin, `/admin/customers?q=${encodeURIComponent(email)}`);
    await admin.getByRole("link", { name: "Reset Tester" }).first().click();
    // Both test customers share a phone number, so this customer can have more than one login.
    const login = admin.getByRole("region", { name: `Website account ${email}` });
    await expect(login).toBeVisible();
    await login.getByRole("button", { name: "Create password link" }).click();
    const link = await login.getByLabel("Password reset link").inputValue();
    expect(link).toContain("/account/reset-password?token=");

    // Customer uses it on another device: new password, signed in, other sessions ended.
    await other.goto(new URL(link).pathname + new URL(link).search);
    await other.getByLabel("New password").fill("Another-password-9");
    await other.getByRole("button", { name: "Save new password" }).click();
    await expect(other).toHaveURL(/\/account\?reset=1/, { timeout: 20_000 });
    await expect(other.getByText("Your new password is saved.")).toBeVisible();
    await other.goto(new URL(link).pathname + new URL(link).search);
    await expect(other.getByRole("heading", { name: "This link has expired" })).toBeVisible();

    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/sign-in/); // the first device was signed out

    // Delete the account from settings (password confirmed). The order stays with the business.
    await other.goto("/account/settings");
    await other.getByRole("button", { name: "Delete my account" }).click();
    await other.getByLabel("Confirm with your password").fill("Another-password-9");
    await other.getByRole("button", { name: "Delete account" }).click();
    await expect(other).toHaveURL(/\/\?account=deleted/, { timeout: 20_000 });
    await other.goto("/account");
    await expect(other).toHaveURL(/\/account\/sign-in/);

    await admin.goto(`/admin/orders?q=${reference}`);
    await expect(admin.getByText(reference).filter({ visible: true }).first()).toBeVisible();
    await guest.close();
    await adminCtx.close();
  });
});
