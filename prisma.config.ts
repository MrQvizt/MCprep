import "dotenv/config";
import { defineConfig } from "prisma/config";
import { migrationDatabaseUrl } from "./src/lib/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // Optional: `prisma generate` (npm postinstall) must work on build machines
    // without database access. Migrations use the direct (non-pooled) URL —
    // DATABASE_URL / DIRECT_DATABASE_URL, or the Supabase integration's
    // POSTGRES_URL_NON_POOLING.
    url: migrationDatabaseUrl(),
  },
});
