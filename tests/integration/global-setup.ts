import { execSync } from "node:child_process";
import "dotenv/config";

/**
 * Integration tests run against a real PostgreSQL database.
 * TEST_DATABASE_URL must point at a disposable database: pending migrations
 * are applied (non-destructive `migrate deploy`) and every table is truncated
 * before each test.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database for integration tests.");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error("Refusing to run: the TEST_DATABASE_URL database name must contain 'test'.");
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}
