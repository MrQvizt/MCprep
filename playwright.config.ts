import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * End-to-end tests run against a production build using a dedicated,
 * disposable database (E2E_DATABASE_URL — wiped and demo-seeded first).
 */
if (!process.env.E2E_DATABASE_URL) {
  throw new Error("Set E2E_DATABASE_URL to a disposable database (its name must contain 'e2e').");
}
const PORT = Number(process.env.E2E_PORT ?? 3200);
const baseURL = `http://localhost:${PORT}`;
const e2eDb = process.env.E2E_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts|order\.spec\.ts/ },
  ],
  webServer: {
    // The database is prepared first (Playwright starts the server before any global setup).
    command:
      process.env.E2E_WEB_SERVER_COMMAND ??
      `npx tsx tests/e2e/prepare.ts && npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: e2eDb,
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SITE_URL: baseURL,
      EMAIL_TRANSPORT: "console",
      STORAGE_DRIVER: "local",
      UPLOAD_DIR: "./storage/e2e-uploads",
      ALLOW_INDEXING: "true",
      CRON_SECRET: "e2e-cron-secret",
      AUTH_TRUST_HOST: "true",
    },
  },
});
