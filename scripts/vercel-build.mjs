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

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
const isSet = (k) => Boolean(process.env[k] && process.env[k].trim());
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Migrations need a session-mode connection, and a pooler's session slots can
 * be briefly full while the previous deployment still holds connections — so
 * retry a few times before failing the build.
 */
function runWithRetry(cmd, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return run(cmd);
    } catch (error) {
      if (i >= attempts) throw error;
      const wait = 15 * i;
      console.warn(`⚠ "${cmd}" failed (attempt ${i} of ${attempts}); retrying in ${wait}s…`);
      sleep(wait * 1000);
    }
  }
}

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

if (dbConfigured && process.env.SKIP_DB_MIGRATIONS !== "1") {
  console.log("▶ Applying database migrations…");
  runWithRetry("npx prisma migrate deploy");
  if (process.env.SKIP_DB_SEED !== "1") {
    console.log("▶ Adding starter content (first deploy only)…");
    run("npx tsx --conditions=react-server prisma/seed.ts", { SEED_ONCE: "1" });
  }
} else if (!dbConfigured) {
  console.warn(
    `⚠ No database URL found for the "${process.env.VERCEL_ENV ?? "local"}" environment — skipping migrations.\n` +
      "  Connect Supabase/Postgres to this environment (Vercel → Settings → Environment Variables:\n" +
      "  enable POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING for Production AND Preview) or set DATABASE_URL.",
  );
}

console.log("▶ Building the app…");
run("npx next build");
