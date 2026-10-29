import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { runtimeDatabaseUrl, withNodePostgresSslCompat } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = runtimeDatabaseUrl();
  if (!url) throw new Error("No database configured: set DATABASE_URL (or connect the Supabase/Postgres integration).");
  const adapter = new PrismaPg({ connectionString: withNodePostgresSslCompat(url) });
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
