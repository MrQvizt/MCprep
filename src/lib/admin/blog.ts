import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { extractInternalLinks } from "@/lib/sanitize";
import { STATIC_PAGES } from "@/lib/seo/pages";
import { rankLinkSuggestions, textFromHtml, type LinkCandidate, type LinkSuggestion } from "./blog-utils";

export * from "./blog-utils";

export function newPreviewToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Internal link ideas for an article: service pages, plans, menu, delivery areas, meals and other posts. */
export async function getInternalLinkSuggestions(post: {
  id?: string;
  slug?: string;
  title: string;
  primaryTopic: string | null;
  contentHtml: string;
}): Promise<LinkSuggestion[]> {
  const now = new Date();
  const [posts, meals] = await Promise.all([
    db.blogPost.findMany({
      where: { status: "PUBLISHED", publishAt: { lte: now }, ...(post.id ? { id: { not: post.id } } : {}) },
      select: { slug: true, title: true, primaryTopic: true, excerpt: true },
      take: 50,
      orderBy: { publishAt: "desc" },
    }),
    db.meal.findMany({ where: { isPublished: true, archivedAt: null }, select: { slug: true, name: true, shortDescription: true } }),
  ]);
  const candidates: LinkCandidate[] = [
    ...STATIC_PAGES.filter((p) => p.group === "service" || ["menu", "plans", "how-it-works", "faq"].includes(p.key)).map((p) => ({
      path: p.path,
      label: p.label,
      keywords: `${p.primaryTopic} ${p.defaultDescription}`,
      evergreen: p.key === "plans" || p.key === "menu",
    })),
    ...posts.map((p) => ({ path: `/blog/${p.slug}`, label: p.title, keywords: `${p.primaryTopic ?? ""} ${p.excerpt ?? ""}` })),
    ...meals.map((m) => ({ path: `/menu/${m.slug}`, label: m.name, keywords: m.shortDescription ?? "" })),
  ];
  return rankLinkSuggestions(
    { title: post.title, primaryTopic: post.primaryTopic, text: textFromHtml(post.contentHtml), selfPath: post.slug ? `/blog/${post.slug}` : undefined },
    candidates,
    extractInternalLinks(post.contentHtml),
  );
}
