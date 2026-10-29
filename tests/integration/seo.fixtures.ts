import { db } from "@/lib/db";

/** Build FormData from a plain object (booleans → "on" when true, omitted when false). */
export function formData(values: Record<string, string | number | boolean | null | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) {
    if (v === null || v === undefined || v === false) continue;
    fd.set(k, v === true ? "on" : String(v));
  }
  return fd;
}

/** Run a server action expected to call redirect(); returns the redirect target. */
export async function expectRedirect(fn: () => Promise<unknown>): Promise<string> {
  try {
    const result = await fn();
    throw new Error(`Expected a redirect, got ${JSON.stringify(result)}`);
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (!digest.startsWith("NEXT_REDIRECT")) throw error;
    return digest.split(";")[2];
  }
}

export async function createPost(
  overrides: Partial<{
    slug: string;
    title: string;
    status: "DRAFT" | "PUBLISHED";
    publishAt: Date | null;
    contentHtml: string;
    excerpt: string | null;
    seoDescription: string | null;
    noindex: boolean;
    canonicalUrl: string | null;
    needsReview: boolean;
  }> = {},
) {
  return db.blogPost.create({
    data: {
      slug: overrides.slug ?? `post-${Math.random().toString(36).slice(2, 8)}`,
      title: overrides.title ?? "Meal prep tips",
      status: overrides.status ?? "PUBLISHED",
      publishAt: overrides.publishAt === undefined ? new Date(Date.now() - 86_400_000) : overrides.publishAt,
      contentHtml: overrides.contentHtml ?? `<p>${"Useful words about meal prep in Malta. ".repeat(60)}</p>`,
      excerpt: overrides.excerpt === undefined ? "A useful summary of the article for Google and readers." : overrides.excerpt,
      seoDescription: overrides.seoDescription ?? null,
      noindex: overrides.noindex ?? false,
      canonicalUrl: overrides.canonicalUrl ?? null,
      needsReview: overrides.needsReview ?? false,
    },
  });
}

export async function createMeal(overrides: Partial<{ slug: string; name: string; isPublished: boolean; archivedAt: Date | null }> = {}) {
  return db.meal.create({
    data: {
      slug: overrides.slug ?? `meal-${Math.random().toString(36).slice(2, 8)}`,
      name: overrides.name ?? "Chicken Pokébowl",
      shortDescription: "A macro-counted chicken poké bowl.",
      isPublished: overrides.isPublished ?? true,
      archivedAt: overrides.archivedAt ?? null,
    },
  });
}

export async function createOrderRow() {
  const n = Math.floor(Math.random() * 1e9);
  return db.order.create({
    data: {
      reference: `MCP-T${n}`,
      idempotencyKey: `idem-${n}`,
      customerName: "Test Customer",
      customerEmail: "test@example.com",
      customerPhone: "+35679123456",
      fulfillmentMethod: "COLLECTION",
      planName: "2 Weeks",
      planDurationDays: 14,
      privacyAcknowledgedAt: new Date(),
    },
  });
}
