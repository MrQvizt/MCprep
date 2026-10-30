/**
 * Apply pending content releases (see prisma/releases/index.ts).
 *   npm run db:releases
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { applyReleases } from "./releases";

applyReleases(db)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
