/**
 * Vercel build: apply pending database migrations, add starter content on the
 * very first deploy, then build the app. Vercel runs `npm run vercel-build`
 * automatically when this script exists.
 *
 * - Migrations use `prisma migrate deploy` (only applies new migrations,
 *   never resets or deletes data).
 * - Starter content is brand-safe and seeded once (SEED_ONCE), so content the
 *   owner deletes is never re-created on later deploys.
 * - If SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD are set, the first owner
 *   account is created (only if that email doesn't exist yet). Remove them
 *   after signing in.
 * - Without any database URL the app is still built (nothing is migrated).
 */
import { execSync } from "node:child_process";

const has = (k) => Boolean(process.env[k] && process.env[k].trim());
const dbConfigured = ["DATABASE_URL", "POSTGRES_URL_NON_POOLING", "POSTGRES_URL", "POSTGRES_PRISMA_URL"].some(has);
const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

if (dbConfigured && process.env.SKIP_DB_MIGRATIONS !== "1") {
  console.log("▶ Applying database migrations…");
  run("npx prisma migrate deploy");
  if (process.env.SKIP_DB_SEED !== "1") {
    console.log("▶ Adding starter content (first deploy only)…");
    run("npx tsx --conditions=react-server prisma/seed.ts", { SEED_ONCE: "1" });
  }
} else {
  console.warn("⚠ No database URL found — skipping migrations. Connect Supabase/Postgres or set DATABASE_URL.");
}

console.log("▶ Building the app…");
run("npx next build");
