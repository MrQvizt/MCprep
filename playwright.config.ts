import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * End-to-end tests run against a production build using a dedicated,
 * disposable database (E2E_DATABASE_URL — wiped and demo-seeded first).
 */
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
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts|order\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_WEB_SERVER_COMMAND ?? `npm run build && npx next start -p ${PORT}`,
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
