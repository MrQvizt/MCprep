import { expect, test } from "@playwright/test";

test.describe("security boundaries", () => {
  test("admin pages redirect anonymous visitors to sign in", async ({ page }) => {
    for (const path of ["/admin", "/admin/orders", "/admin/plans", "/admin/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });

  test("admin and cron APIs reject anonymous requests", async ({ request }) => {
    expect((await request.get("/api/admin/media")).status()).toBe(401);
    expect((await request.post("/api/admin/media", { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") } } })).status()).toBe(401);
    expect((await request.get("/api/admin/orders/export")).status()).toBeGreaterThanOrEqual(401);
    expect((await request.get("/api/cron/outbox")).status()).toBe(401);
    expect((await request.get("/api/cron/daily", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  });

  test("order confirmation pages need the private token", async ({ request }) => {
    expect((await request.get("/order/confirmation?ref=MCP-000001")).status()).toBe(404);
    expect((await request.get("/order/confirmation?ref=MCP-000001&t=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).status()).toBe(404);
  });

  test("cron endpoint works with the secret", async ({ request }) => {
    const res = await request.get("/api/cron/outbox", { headers: { authorization: "Bearer e2e-cron-secret" } });
    expect(res.status()).toBe(200);
  });

  test("security headers are sent", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});
