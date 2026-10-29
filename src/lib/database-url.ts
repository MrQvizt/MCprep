/**
 * Database connection strings.
 *
 * Works with a plain `DATABASE_URL` (local development, Neon, RDS …) and with
 * the variables Vercel's Supabase / Postgres integrations create:
 *   POSTGRES_PRISMA_URL / POSTGRES_URL  → pooled connection (app runtime)
 *   POSTGRES_URL_NON_POOLING            → direct/session connection (migrations)
 *
 * Kept free of framework imports so prisma.config.ts and scripts can use it.
 */

type Env = Record<string, string | undefined>;

const clean = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : undefined);

/**
 * Value of an integration variable, also when Vercel added it with a custom
 * prefix (e.g. "MCPREP_POSTGRES_URL_NON_POOLING"). Exact names win.
 */
function integrationVar(env: Env, name: string): string | undefined {
  const exact = clean(env[name]);
  if (exact) return exact;
  const key = Object.keys(env)
    .filter((k) => k.endsWith(`_${name}`) && clean(env[k]))
    .sort()[0];
  return key ? clean(env[key]) : undefined;
}

/** Connection string the application uses at runtime (pooled where available). */
export function runtimeDatabaseUrl(env: Env = process.env): string | undefined {
  return clean(env.DATABASE_URL) ?? integrationVar(env, "POSTGRES_PRISMA_URL") ?? integrationVar(env, "POSTGRES_URL");
}

/**
 * Connection string for `prisma migrate` (must not go through a transaction
 * pooler). Uses the same database as the runtime URL.
 */
export function migrationDatabaseUrl(env: Env = process.env): string | undefined {
  if (clean(env.DATABASE_URL)) return clean(env.DIRECT_DATABASE_URL) ?? clean(env.DATABASE_URL);
  return integrationVar(env, "POSTGRES_URL_NON_POOLING") ?? integrationVar(env, "POSTGRES_URL");
}

/** Names (never values) of database-related variables that are set — for build diagnostics. */
export function databaseEnvNames(env: Env = process.env): string[] {
  return Object.keys(env)
    .filter((k) => /DATABASE|POSTGRES|SUPABASE/i.test(k) && clean(env[k]))
    .sort();
}

/**
 * Supabase's shared pooler (`*.pooler.supabase.com`) runs two modes:
 *   port 5432 — session mode: every client holds a database connection for as
 *               long as it stays connected (only ~15 on small plans);
 *   port 6543 — transaction mode: clients share connections per transaction.
 * Serverless functions open many short-lived clients, which exhausts session
 * mode ("max clients reached in session mode"), so the app uses transaction
 * mode at runtime. Migrations keep using the URL exactly as given.
 * Set DATABASE_POOLER_MODE=session to opt out.
 */
export function preferTransactionPooler(url: string, env: Env = process.env): string {
  if (clean(env.DATABASE_POOLER_MODE)?.toLowerCase() === "session") return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!parsed.hostname.endsWith(".pooler.supabase.com")) return url;
  if (parsed.port !== "" && parsed.port !== "5432") return url;
  parsed.port = "6543";
  return parsed.toString();
}

/**
 * node-postgres treats `sslmode=require` as full certificate verification,
 * which rejects Supabase's own certificate authority. `uselibpqcompat=true`
 * restores the standard PostgreSQL meaning (encrypted connection). Explicit
 * `verify-ca` / `verify-full` settings are left untouched.
 */
export function withNodePostgresSslCompat(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const mode = parsed.searchParams.get("sslmode");
  if ((mode === "require" || mode === "prefer") && !parsed.searchParams.has("uselibpqcompat")) {
    parsed.searchParams.set("uselibpqcompat", "true");
  }
  // PgBouncer hints are for other drivers; node-postgres doesn't need them.
  parsed.searchParams.delete("pgbouncer");
  return parsed.toString();
}
