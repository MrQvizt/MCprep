/** Pure blog helpers (no database) — safe for unit tests and client components. */

export type BlogVisibility = "DRAFT" | "SCHEDULED" | "PUBLISHED";

export function blogVisibility(post: { status: string; publishAt: Date | null }, now: Date = new Date()): BlogVisibility {
  if (post.status !== "PUBLISHED") return "DRAFT";
  if (!post.publishAt || post.publishAt.getTime() > now.getTime()) return "SCHEDULED";
  return "PUBLISHED";
}

export const BLOG_VISIBILITY_LABELS: Record<BlogVisibility, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
};

/** Plain words from HTML/text. */
export function textFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(html: string): number {
  const text = textFromHtml(html);
  return text ? text.split(" ").length : 0;
}

/** Minutes to read at ~220 words per minute (minimum 1). */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 220));
}

export const THIN_CONTENT_WORDS = 300;

const STOPWORDS = new Set(
  "about after again also because been before being between both could does doing down during each from further have having here into itself just more most other over same should some such than that their them then there these they this those through under until very what when where which while with would your yours you're with will".split(
    " ",
  ),
);

export function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  const out = new Set<string>();
  for (const w of words) {
    out.add(w);
    // crude singularisation so "meals"/"meal" and "plans"/"plan" match
    if (w.endsWith("s") && w.length > 4) out.add(w.slice(0, -1));
  }
  return out;
}

export interface LinkCandidate {
  path: string;
  label: string;
  keywords: string;
  /** Pages worth linking from most articles (plans, menu). */
  evergreen?: boolean;
}

export interface LinkSuggestion {
  path: string;
  label: string;
  score: number;
  alreadyLinked: boolean;
  matched: string[];
}

/**
 * Rank internal link suggestions for an article by keyword overlap with its
 * title, primary topic and text. Already-linked pages are flagged, not hidden.
 */
export function rankLinkSuggestions(
  article: { title: string; primaryTopic?: string | null; text: string; selfPath?: string },
  candidates: LinkCandidate[],
  existingLinks: string[],
  limit = 8,
): LinkSuggestion[] {
  const articleTokens = tokenize(`${article.title} ${article.primaryTopic ?? ""} ${article.text}`);
  const topicTokens = tokenize(`${article.title} ${article.primaryTopic ?? ""}`);
  const linked = new Set(existingLinks.map((l) => l.toLowerCase().replace(/\/+$/, "") || "/"));
  const results: LinkSuggestion[] = [];
  for (const c of candidates) {
    if (article.selfPath && c.path === article.selfPath) continue;
    const kw = tokenize(`${c.label} ${c.keywords}`);
    const matched = [...kw].filter((w) => articleTokens.has(w));
    let score = matched.length + [...kw].filter((w) => topicTokens.has(w)).length;
    if (c.evergreen) score += 1;
    if (score <= 0) continue;
    results.push({
      path: c.path,
      label: c.label,
      score,
      alreadyLinked: linked.has(c.path.toLowerCase()),
      matched: [...new Set(matched)].slice(0, 5),
    });
  }
  return results.sort((a, b) => Number(a.alreadyLinked) - Number(b.alreadyLinked) || b.score - a.score).slice(0, limit);
}

/**
 * Accepts either the full Google/Bing verification meta tag or just its
 * content value and returns the value (letters, digits, - and _ only).
 */
export function extractVerificationCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const fromTag = /content\s*=\s*["']([^"']+)["']/i.exec(trimmed);
  const value = (fromTag ? fromTag[1] : trimmed).trim();
  return /^[A-Za-z0-9_\-.]{6,128}$/.test(value) ? value : null;
}
