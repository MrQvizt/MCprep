/**
 * Prepare the disposable E2E database before the app starts:
 * apply migrations, wipe all tables, demo-seed, create the E2E owner.
 * Runs with DATABASE_URL pointing at E2E_DATABASE_URL (name must contain "e2e").
 */
import { execSync } from "node:child_process";
import { E2E_ADMIN } from "./helpers";

const url = process.env.DATABASE_URL ?? "";
if (!url || !/e2e/i.test(new URL(url).pathname)) {
  throw new Error("Refusing to run: set E2E_DATABASE_URL to a disposable database whose name contains 'e2e'.");
}
const env = { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" };
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npx tsx --conditions=react-server tests/e2e/prepare-db.ts", { stdio: "inherit", env });
execSync("npx tsx --conditions=react-server prisma/seed.ts", {
  stdio: "inherit",
  env: {
    ...env,
    SEED_PROFILE: "demo",
    SEED_ADMIN_EMAIL: E2E_ADMIN.email,
    SEED_ADMIN_PASSWORD: E2E_ADMIN.password,
    SEED_ADMIN_NAME: "E2E Owner",
  },
});
