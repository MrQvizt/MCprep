import "dotenv/config";
import { db } from "@/lib/db";

/** Truncate all tables in the E2E database (guarded by database name). */
async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/e2e/i.test(new URL(url).pathname)) throw new Error("Refusing to wipe a database whose name doesn't contain 'e2e'.");
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
