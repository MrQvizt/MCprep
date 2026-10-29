import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { preferTransactionPooler, runtimeDatabaseUrl, withNodePostgresSslCompat } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const serverless = Boolean(process.env.VERCEL);

/** Connections per server instance. Kept small on Vercel, where many instances can run at once. */
function poolSize(): number {
  const n = Number(process.env.DATABASE_POOL_MAX);
  return Number.isInteger(n) && n > 0 ? n : serverless ? 5 : 10;
}

function createClient() {
  const url = runtimeDatabaseUrl();
  if (!url) throw new Error("No database configured: set DATABASE_URL (or connect the Supabase/Postgres integration).");
  const adapter = new PrismaPg({
    connectionString: withNodePostgresSslCompat(preferTransactionPooler(url)),
    max: poolSize(),
    // Serverless instances may be frozen between requests: release idle connections quickly.
    idleTimeoutMillis: serverless ? 5_000 : 10_000,
    // Fail a request clearly instead of hanging until the function times out.
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

/**
 * Prisma client, created on first use. Importing this module never touches
 * the database or requires a database URL, so `next build` works on build
 * machines without database access; requests fail clearly if it's missing.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type { PrismaClient };
