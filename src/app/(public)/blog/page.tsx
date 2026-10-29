import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CtaBand } from "@/components/public/cta-band";
import { PageHero } from "@/components/public/page-hero";
import { PostCard } from "@/components/public/post-card";
import { Section } from "@/components/public/section";
import { getContent } from "@/lib/content";
import { parsePage } from "@/lib/public/blog";
import { getBlogCategories, getBlogListing } from "@/lib/public/data";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { buildMetadata, getPageSeo } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils";

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ searchParams }: PageProps<"/blog">): Promise<Metadata> {
  const sp = await searchParams;
  const category = one(sp.category);
  const page = parsePage(sp.page);
  const seo = await getPageSeo("blog");
  return buildMetadata({
    title: page > 1 ? `${seo.title} — Page ${page}` : seo.title,
    description: seo.description,
    path: page > 1 && !category ? `/blog?page=${page}` : "/blog",
    ogTitle: seo.ogTitle,
    ogDescription: seo.ogDescription,
    ogImage: seo.ogImage,
    // Category filters are thin duplicates of /blog: keep them out of the index.
    noindex: seo.noindex || Boolean(category),
    canonical: category ? "/blog" : seo.canonical,
  });
}

export default async function BlogIndexPage({ searchParams }: PageProps<"/blog">) {
  const sp = await searchParams;
  const category = one(sp.category) ?? null;
  const requested = parsePage(sp.page);
  const [content, crumb, categories, listing, whatsappHref] = await Promise.all([
    getContent("page.blog"),
    crumbFor("blog"),
    getBlogCategories(),
    getBlogListing({ categorySlug: category, page: requested }),
    getWhatsappHref(),
  ]);
  const activeCategory = categories.find((c) => c.slug === category) ?? null;
  const [first, ...rest] = listing.posts;
  const showFeature = listing.page === 1 && first;
  const qs = (page: number) => {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return s ? `/blog?${s}` : "/blog";
  };

  return (
    <>
      <PageHero crumbs={[crumb]} eyebrow={content.eyebrow} title={activeCategory ? activeCategory.name : content.heading} intro={content.intro} />
      <Section tone="paper" aria-label="Articles" className="pt-10 sm:pt-12">
        {categories.length > 0 && (
          <nav aria-label="Blog categories" className="mb-12 border-b border-ink/10 pb-6">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href="/blog"
                  aria-current={!category ? "page" : undefined}
                  className={cn("inline-flex h-9 items-center border px-4 text-xs font-semibold uppercase tracking-[0.12em]", !category ? "border-ink bg-ink text-white" : "border-ink/20 hover:border-ink")}
                >
                  All
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/blog?category=${c.slug}`}
                    aria-current={category === c.slug ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center border px-4 text-xs font-semibold uppercase tracking-[0.12em]",
                      category === c.slug ? "border-ink bg-ink text-white" : "border-ink/20 hover:border-ink",
                    )}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {listing.posts.length === 0 ? (
          <div className="border border-dashed border-ink/20 px-6 py-20 text-center">
            <h2 className="display-md">Articles coming soon</h2>
            <p className="mx-auto mt-3 max-w-md text-smoke">We&apos;re writing practical guides on meal prep, macros and eating well in Malta. Check back soon.</p>
          </div>
        ) : (
          <>
            {showFeature && <PostCard post={first} featured className="mb-16 border-b border-ink/10 pb-16" />}
            {(showFeature ? rest : listing.posts).length > 0 && (
              <ul className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {(showFeature ? rest : listing.posts).map((post) => (
                  <li key={post.id}>
                    <PostCard post={post} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {listing.pages > 1 && (
          <nav aria-label="Pagination" className="mt-16 flex items-center justify-between border-t border-ink/10 pt-6 text-sm font-semibold uppercase tracking-[0.12em]">
            {listing.page > 1 ? (
              <Link href={qs(listing.page - 1)} rel="prev" className="inline-flex items-center gap-2 hover:underline underline-offset-4">
                <ChevronLeft className="size-4" /> Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-smoke tabular">
              Page {listing.page} of {listing.pages}
            </span>
            {listing.page < listing.pages ? (
              <Link href={qs(listing.page + 1)} rel="next" className="inline-flex items-center gap-2 hover:underline underline-offset-4">
                Older <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Section>
      <CtaBand whatsappHref={whatsappHref} tone="charcoal" />
    </>
  );
}
