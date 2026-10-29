import { describe, expect, it } from "vitest";
import { migrationDatabaseUrl, runtimeDatabaseUrl, withNodePostgresSslCompat } from "@/lib/database-url";

const supabase = {
  POSTGRES_PRISMA_URL: "postgres://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true",
  POSTGRES_URL: "postgres://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require",
  POSTGRES_URL_NON_POOLING: "postgres://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
};

describe("database URLs", () => {
  it("prefers DATABASE_URL, with DIRECT_DATABASE_URL for migrations", () => {
    const env = { DATABASE_URL: "postgres://a/app", DIRECT_DATABASE_URL: "postgres://a/direct", ...supabase };
    expect(runtimeDatabaseUrl(env)).toBe("postgres://a/app");
    expect(migrationDatabaseUrl(env)).toBe("postgres://a/direct");
    expect(migrationDatabaseUrl({ DATABASE_URL: "postgres://a/app" })).toBe("postgres://a/app");
  });

  it("uses Vercel's Supabase integration variables when DATABASE_URL is absent", () => {
    expect(runtimeDatabaseUrl(supabase)).toBe(supabase.POSTGRES_PRISMA_URL);
    expect(migrationDatabaseUrl(supabase)).toBe(supabase.POSTGRES_URL_NON_POOLING);
  });

  it("returns undefined when nothing is configured (build machines)", () => {
    expect(runtimeDatabaseUrl({})).toBeUndefined();
    expect(migrationDatabaseUrl({ DATABASE_URL: "  " })).toBeUndefined();
  });

  it("uses Supabase's transaction pooler for the app and its session pooler for migrations", () => {
    const session = "postgresql://postgres.ref:p%40ss@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";
    const transaction = "postgresql://postgres.ref:p%40ss@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";
    expect(runtimeDatabaseUrl({ DATABASE_URL: session })).toBe(transaction);
    expect(migrationDatabaseUrl({ DATABASE_URL: session })).toBe(session);
    expect(runtimeDatabaseUrl({ DATABASE_URL: transaction })).toBe(transaction);
    expect(migrationDatabaseUrl({ DATABASE_URL: transaction })).toBe(session);
    // No port means PostgreSQL's default, 5432 (session mode).
    expect(runtimeDatabaseUrl({ DATABASE_URL: session.replace(":5432", "") })).toBe(transaction);
    // Other ports, direct database hosts and other providers are unchanged.
    const other = "postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:7000/postgres";
    expect(runtimeDatabaseUrl({ DATABASE_URL: other })).toBe(other);
    const direct = "postgresql://postgres:p@db.ref.supabase.co:5432/postgres";
    expect(runtimeDatabaseUrl({ DATABASE_URL: direct })).toBe(direct);
    expect(runtimeDatabaseUrl({ DATABASE_URL: "postgresql://u:p@example.com:5432/db" })).toBe(
      "postgresql://u:p@example.com:5432/db",
    );
  });

  it("encrypts Supabase connections unless the URL chooses an SSL setting", () => {
    const pooler = new URL(withNodePostgresSslCompat("postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"));
    expect(pooler.searchParams.get("sslmode")).toBe("require");
    expect(pooler.searchParams.get("uselibpqcompat")).toBe("true");
    const direct = new URL(withNodePostgresSslCompat("postgresql://u:p@db.ref.supabase.co:5432/postgres"));
    expect(direct.searchParams.get("sslmode")).toBe("require");
    const explicit = withNodePostgresSslCompat("postgresql://u:p@db.ref.supabase.co:5432/postgres?sslmode=verify-full");
    expect(new URL(explicit).searchParams.get("sslmode")).toBe("verify-full");
    const sslParam = withNodePostgresSslCompat("postgresql://u:p@db.ref.supabase.co:5432/postgres?ssl=true");
    expect(new URL(sslParam).searchParams.has("sslmode")).toBe(false);
  });

  it("keeps sslmode=require meaning 'encrypted' for node-postgres and drops pgbouncer hints", () => {
    const out = new URL(withNodePostgresSslCompat(supabase.POSTGRES_PRISMA_URL));
    expect(out.searchParams.get("sslmode")).toBe("require");
    expect(out.searchParams.get("uselibpqcompat")).toBe("true");
    expect(out.searchParams.has("pgbouncer")).toBe(false);
    // Explicit verification modes are respected.
    const strict = withNodePostgresSslCompat("postgres://u:p@h:5432/db?sslmode=verify-full");
    expect(new URL(strict).searchParams.has("uselibpqcompat")).toBe(false);
    // Local URLs without SSL are unchanged.
    expect(withNodePostgresSslCompat("postgresql://u:p@localhost:5432/db?schema=public")).toBe(
      "postgresql://u:p@localhost:5432/db?schema=public",
    );
  });
});

describe("integration variables with a custom prefix", () => {
  it("finds prefixed Supabase variables and lists names only", async () => {
    const { databaseEnvNames } = await import("@/lib/database-url");
    const env = {
      MCPREP_POSTGRES_PRISMA_URL: "postgres://pooled",
      MCPREP_POSTGRES_URL_NON_POOLING: "postgres://direct",
      MCPREP_SUPABASE_URL: "https://x.supabase.co",
      OTHER: "x",
    };
    expect(runtimeDatabaseUrl(env)).toBe("postgres://pooled");
    expect(migrationDatabaseUrl(env)).toBe("postgres://direct");
    expect(databaseEnvNames(env)).toEqual(["MCPREP_POSTGRES_PRISMA_URL", "MCPREP_POSTGRES_URL_NON_POOLING", "MCPREP_SUPABASE_URL"]);
  });
});
