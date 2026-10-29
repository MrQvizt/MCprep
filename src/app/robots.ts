import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { absoluteUrl, indexingAllowed } from "@/lib/env";

/**
 * Production: crawl everything public except admin, API and order
 * confirmation pages. Preview/staging deployments: block all crawling.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  if (!indexingAllowed()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/order/confirmation"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
