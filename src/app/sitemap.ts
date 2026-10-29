import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSitemapEntries } from "@/lib/seo/sitemap";

/** Generated on every request so published/unpublished content is reflected immediately. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return getSitemapEntries(new Date());
}
