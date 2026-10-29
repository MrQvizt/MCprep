import "server-only";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";

export async function getEditorContext() {
  const [categories, settings] = await Promise.all([
    db.blogCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    getSettings(),
  ]);
  return {
    categories,
    siteUrl: siteUrl(),
    siteName: settings.business.tradingName,
    titleSuffix: settings.seo.titleSuffix || settings.business.tradingName,
  };
}
