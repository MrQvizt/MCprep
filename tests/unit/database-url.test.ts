import { describe, expect, it } from "vitest";
import {
  migrationDatabaseUrl,
  preferTransactionPooler,
  runtimeDatabaseUrl,
  withNodePostgresSslCompat,
} from "@/lib/database-url";

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

  it("moves Supabase's session pooler to transaction mode for the app (not for migrations)", () => {
    const session = "postgresql://postgres.ref:p%40ss@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require";
    const out = new URL(preferTransactionPooler(session, {}));
    expect(out.port).toBe("6543");
    expect(out.username).toBe("postgres.ref");
    expect(out.password).toBe("p%40ss");
    expect(out.searchParams.get("sslmode")).toBe("require");
    // Default port (5432) is treated the same.
    expect(new URL(preferTransactionPooler("postgres://u:p@aws-1-eu-west-1.pooler.supabase.com/postgres", {})).port).toBe(
      "6543",
    );
    // Migrations are untouched.
    expect(migrationDatabaseUrl({ DATABASE_URL: session })).toBe(session);
  });

  it("leaves other databases, transaction-mode URLs and the opt-out alone", () => {
    const tx = supabase.POSTGRES_PRISMA_URL;
    expect(preferTransactionPooler(tx, {})).toBe(tx);
    expect(preferTransactionPooler("postgres://u:p@db.ref.supabase.co:5432/postgres", {})).toBe(
      "postgres://u:p@db.ref.supabase.co:5432/postgres",
    );
    expect(preferTransactionPooler("postgres://u:p@localhost:5432/app", {})).toBe("postgres://u:p@localhost:5432/app");
    const session = supabase.POSTGRES_URL_NON_POOLING;
    expect(preferTransactionPooler(session, { DATABASE_POOLER_MODE: "session" })).toBe(session);
    expect(preferTransactionPooler("not a url", {})).toBe("not a url");
  });
});
