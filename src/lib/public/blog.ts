/** Pure blog visibility and listing helpers. */

export const BLOG_PAGE_SIZE = 9;

export interface PostVisibilityInput {
  status: "DRAFT" | "PUBLISHED";
  publishAt: Date | null;
}

/** A post is public when published and its publish time (if any) has passed. */
export function isPostPublic(post: PostVisibilityInput, now: Date): boolean {
  if (post.status !== "PUBLISHED") return false;
  return post.publishAt === null || post.publishAt.getTime() <= now.getTime();
}

/** Prisma `where` for public posts (mirrors isPostPublic). */
export function publicPostWhere(now: Date) {
  return {
    status: "PUBLISHED" as const,
    OR: [{ publishAt: null }, { publishAt: { lte: now } }],
  };
}

/** A draft/scheduled post can be previewed only with its exact preview token. */
export function canPreviewPost(post: { previewToken: string | null }, token: string | null | undefined): boolean {
  return Boolean(post.previewToken && token && post.previewToken === token);
}

export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}

export function paginate(total: number, page: number, perPage = BLOG_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pages);
  return { page: current, pages, skip: (current - 1) * perPage, take: perPage };
}

export function readingMinutes(text: string): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 220));
}
