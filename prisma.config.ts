import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // Read optionally: `prisma generate` (npm postinstall) must work on build
    // machines without database access. Migrate/seed commands still need it.
    url: process.env.DATABASE_URL,
  },
});
