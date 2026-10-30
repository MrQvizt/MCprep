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
 * - Preview builds never change the database unless PREVIEW_DB_MIGRATIONS=1.
 */
import { execSync } from "node:child_process";

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
const isSet = (k) => Boolean(process.env[k] && process.env[k].trim());

// Same rules as src/lib/database-url.ts (exact names, or integration names with a custom prefix).
const DB_NAMES = ["DATABASE_URL", "POSTGRES_URL_NON_POOLING", "POSTGRES_PRISMA_URL", "POSTGRES_URL"];
const dbConfigured = Object.keys(process.env).some(
  (k) => isSet(k) && DB_NAMES.some((n) => k === n || k.endsWith(`_${n}`)),
);
const related = Object.keys(process.env)
  .filter((k) => /DATABASE|POSTGRES|SUPABASE/i.test(k) && isSet(k))
  .sort();

console.log(`▶ Environment: ${process.env.VERCEL_ENV ?? "local"}`);
console.log(`▶ Database-related variables available (names only): ${related.length ? related.join(", ") : "none"}`);

// Database changes (migrations, starter content, content releases) only run on
// production deploys. Preview builds often share the production database, and a
// preview of unmerged code must never change it. If previews have their own
// database, set PREVIEW_DB_MIGRATIONS=1 for the Preview environment.
const env = process.env.VERCEL_ENV ?? "local";
const changesAllowed = env === "production" || env === "local" || process.env.PREVIEW_DB_MIGRATIONS === "1";

if (dbConfigured && changesAllowed && process.env.SKIP_DB_MIGRATIONS !== "1") {
  console.log("▶ Applying database migrations…");
  run("npx prisma migrate deploy");
  if (process.env.SKIP_DB_SEED !== "1") {
    console.log("▶ Adding starter content (first deploy only) and content updates…");
    run("npx tsx --conditions=react-server prisma/seed.ts", { SEED_ONCE: "1" });
  }
} else if (dbConfigured && !changesAllowed) {
  console.log(
    `▶ ${env} build: database left unchanged (migrations and content updates run on production deploys only;\n` +
      "  set PREVIEW_DB_MIGRATIONS=1 if this environment has its own database).",
  );
} else if (!dbConfigured) {
  console.warn(
    `⚠ No database URL found for the "${env}" environment — skipping migrations.\n` +
      "  Set DATABASE_URL (and DIRECT_DATABASE_URL) for this environment in Vercel → Settings → Environment Variables.",
  );
}

console.log("▶ Building the app…");
run("npx next build");
