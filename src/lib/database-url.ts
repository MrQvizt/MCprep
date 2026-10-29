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

/**
 * Supabase's shared pooler serves the same database on two ports:
 *   5432 — session mode: every client holds its own database connection
 *          (only 15 on small plans), which serverless functions use up fast;
 *   6543 — transaction mode: database connections are shared between requests.
 * The app must use transaction mode and `prisma migrate` session mode, so a
 * pooler URL with either port is switched to the right one. Other hosts and
 * ports are left untouched.
 */
const SUPABASE_POOLER_HOST = /\.pooler\.supabase\.com$/i;
const SESSION_PORT = "5432";
const TRANSACTION_PORT = "6543";

function withSupabasePoolerPort(url: string, port: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!SUPABASE_POOLER_HOST.test(parsed.hostname)) return url;
  const current = parsed.port || SESSION_PORT;
  if (current === port || (current !== SESSION_PORT && current !== TRANSACTION_PORT)) return url;
  parsed.port = port;
  return parsed.toString();
}

/** Connection string the application uses at runtime (pooled where available). */
export function runtimeDatabaseUrl(env: Env = process.env): string | undefined {
  const url = clean(env.DATABASE_URL) ?? integrationVar(env, "POSTGRES_PRISMA_URL") ?? integrationVar(env, "POSTGRES_URL");
  return url && withSupabasePoolerPort(url, TRANSACTION_PORT);
}

/**
 * Connection string for `prisma migrate` (must not go through a transaction
 * pooler). Uses the same database as the runtime URL.
 */
export function migrationDatabaseUrl(env: Env = process.env): string | undefined {
  const url = clean(env.DATABASE_URL)
    ? (clean(env.DIRECT_DATABASE_URL) ?? clean(env.DATABASE_URL))
    : (integrationVar(env, "POSTGRES_URL_NON_POOLING") ?? integrationVar(env, "POSTGRES_URL"));
  return url && withSupabasePoolerPort(url, SESSION_PORT);
}

/** Names (never values) of database-related variables that are set — for build diagnostics. */
export function databaseEnvNames(env: Env = process.env): string[] {
  return Object.keys(env)
    .filter((k) => /DATABASE|POSTGRES|SUPABASE/i.test(k) && clean(env[k]))
    .sort();
}

const SUPABASE_HOST = /\.supabase\.(com|co)$/i;

/**
 * node-postgres treats `sslmode=require` as full certificate verification,
 * which rejects Supabase's own certificate authority. `uselibpqcompat=true`
 * restores the standard PostgreSQL meaning (encrypted connection). Explicit
 * `verify-ca` / `verify-full` settings are left untouched.
 *
 * node-postgres connects without encryption when a URL has no `sslmode`, and
 * the connection strings Supabase's dashboard shows have none, so Supabase
 * hosts default to `sslmode=require` unless the URL sets `ssl` or `sslmode`.
 */
export function withNodePostgresSslCompat(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const sslChosen = parsed.searchParams.has("sslmode") || parsed.searchParams.has("ssl");
  if (SUPABASE_HOST.test(parsed.hostname) && !sslChosen) {
    parsed.searchParams.set("sslmode", "require");
  }
  const mode = parsed.searchParams.get("sslmode");
  if ((mode === "require" || mode === "prefer") && !parsed.searchParams.has("uselibpqcompat")) {
    parsed.searchParams.set("uselibpqcompat", "true");
  }
  // PgBouncer hints are for other drivers; node-postgres doesn't need them.
  parsed.searchParams.delete("pgbouncer");
  return parsed.toString();
}
