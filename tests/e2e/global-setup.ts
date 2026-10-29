import { execSync } from "node:child_process";
import "dotenv/config";

export const E2E_ADMIN = { email: "owner@e2e.test", password: "E2E-Owner-Password-1" };

/** Prepare the disposable E2E database: migrate, wipe, demo-seed, create an owner. */
export default function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Set E2E_DATABASE_URL to a disposable database (its name must contain 'e2e').");
  if (!/e2e/i.test(new URL(url).pathname)) throw new Error("Refusing to run: E2E database name must contain 'e2e'.");
  const env = { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx --conditions=react-server tests/e2e/prepare-db.ts", { stdio: "inherit", env });
  execSync("npx tsx --conditions=react-server prisma/seed.ts", {
    stdio: "inherit",
    env: {
      ...env,
      SEED_PROFILE: "demo",
      UPLOAD_DIR: "./storage/e2e-uploads",
      STORAGE_DRIVER: "local",
      SEED_ADMIN_EMAIL: E2E_ADMIN.email,
      SEED_ADMIN_PASSWORD: E2E_ADMIN.password,
      SEED_ADMIN_NAME: "E2E Owner",
    },
  });
}
