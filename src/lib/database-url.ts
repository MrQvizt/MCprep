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

/** Connection string the application uses at runtime (pooled where available). */
export function runtimeDatabaseUrl(env: Env = process.env): string | undefined {
  return clean(env.DATABASE_URL) ?? clean(env.POSTGRES_PRISMA_URL) ?? clean(env.POSTGRES_URL);
}

/**
 * Connection string for `prisma migrate` (must not go through a transaction
 * pooler). Uses the same database as the runtime URL.
 */
export function migrationDatabaseUrl(env: Env = process.env): string | undefined {
  if (clean(env.DATABASE_URL)) return clean(env.DIRECT_DATABASE_URL) ?? clean(env.DATABASE_URL);
  return clean(env.POSTGRES_URL_NON_POOLING) ?? clean(env.POSTGRES_URL);
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
