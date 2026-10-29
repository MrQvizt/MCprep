import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { CtaBand } from "@/components/public/cta-band";
import { PostCard } from "@/components/public/post-card";
import { RichText } from "@/components/public/rich-text";
import { Section } from "@/components/public/section";
import { JsonLd } from "@/components/shared/json-ld";
import { MediaImage } from "@/components/shared/media-image";
import { getCurrentAdmin } from "@/lib/authz";
import { absoluteUrl } from "@/lib/env";
import { htmlToText } from "@/lib/sanitize";
import { canPreviewPost, isPostPublic, readingMinutes } from "@/lib/public/blog";
import { getBlogPost, getJsonLdContext, getLatestPosts } from "@/lib/public/data";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { requestNow } from "@/lib/public-data";
import { blogPostingJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { formatDate } from "@/lib/time";

type Props = PageProps<"/blog/[slug]">;

async function load(props: Props) {
  const [{ slug }, sp] = await Promise.all([props.params, props.searchParams]);
  const post = await getBlogPost(slug);
  if (!post) return null;
  const now = await requestNow();
  if (isPostPublic(post, now)) return { post, preview: false };
  const token = Array.isArray(sp.preview) ? sp.preview[0] : sp.preview;
  if (canPreviewPost(post, token) || (await getCurrentAdmin())) return { post, preview: true };
  return null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await load(props);
  if (!data) return { title: "Article not found", robots: { index: false } };
  const { post, preview } = data;
  const image = post.ogImage ?? post.coverImage;
  return buildMetadata({
    title: post.seoTitle || `${post.title} | MC PREPS Malta`,
    description: post.seoDescription || post.excerpt || htmlToText(post.contentHtml).slice(0, 155),
    path: `/blog/${post.slug}`,
    ogTitle: post.ogTitle,
    ogDescription: post.ogDescription,
    ogImage: image ? { url: image.url, width: image.width, height: image.height, alt: post.coverAlt ?? image.altText } : null,
    noindex: post.noindex || preview,
    canonical: post.canonicalUrl,
    type: "article",
    publishedTime: (post.publishAt ?? post.createdAt).toISOString(),
    modifiedTime: post.contentUpdatedAt.toISOString(),
  });
}

export default async function BlogPostPage(props: Props) {
  const data = await load(props);
  if (!data) notFound();
  const { post, preview } = data;
  const [blogCrumb, related, ctx, whatsappHref] = await Promise.all([
    crumbFor("blog"),
    getLatestPosts(3, post.id, post.category?.id ?? null),
    getJsonLdContext(),
    getWhatsappHref(),
  ]);
  const published = post.publishAt ?? post.createdAt;
  const updated = post.contentUpdatedAt;
  const showUpdated = updated.getTime() - published.getTime() > 86_400_000;
  const minutes = readingMinutes(htmlToText(post.contentHtml));
  const crumbs = [blogCrumb, ...(post.category ? [{ name: post.category.name, path: `/blog?category=${post.category.slug}` }] : []), { name: post.title, path: `/blog/${post.slug}` }];

  return (
    <>
      {!preview && (
        <JsonLd
          data={blogPostingJsonLd(ctx, {
            title: post.title,
            description: post.seoDescription || post.excerpt,
            path: `/blog/${post.slug}`,
            imageUrl: post.coverImage ? absoluteUrl(post.coverImage.url) : null,
            publishedAt: published,
            modifiedAt: updated,
            authorName: post.authorName,
            authorUrl: post.authorUrl,
          })}
        />
      )}
      {preview && (
        <div role="note" className="bg-[#ffd400] px-4 py-2 text-center text-xs font-semibold text-ink">
          Preview — this article is not published{post.publishAt && post.status === "PUBLISHED" ? ` until ${formatDate(post.publishAt)}` : ""}. It is hidden from search engines.
        </div>
      )}
      <article>
        <header className="border-b border-white/10 bg-ink">
          <div className="container-site pb-14 pt-8 sm:pt-10 lg:pb-20">
            <Breadcrumbs items={crumbs} />
            <div className="mt-12 max-w-4xl">
              {post.category && (
                <Link href={`/blog?category=${post.category.slug}`} className="eyebrow text-fog hover:text-white">
                  {post.category.name}
                </Link>
              )}
              <h1 className="mt-5 display-lg text-balance">{post.title}</h1>
              {post.excerpt && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">{post.excerpt}</p>}
              <p className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-[0.14em] text-fog">
                {post.authorName && <span>By {post.authorName}</span>}
                {preview && !(post.status === "PUBLISHED" && post.publishAt) ? (
                  <span>Draft — not yet published</span>
                ) : (
                  <span>
                    {preview ? "Scheduled for" : "Published"} <time dateTime={published.toISOString()}>{formatDate(published)}</time>
                  </span>
                )}
                {showUpdated && (
                  <span>
                    Updated <time dateTime={updated.toISOString()}>{formatDate(updated)}</time>
                  </span>
                )}
                <span>{minutes} min read</span>
              </p>
            </div>
          </div>
        </header>
        {post.coverImage && (
          <div className="bg-ink">
            <div className="container-site">
              <MediaImage
                media={post.coverImage}
                alt={post.coverAlt ?? post.coverImage.altText ?? ""}
                priority
                sizes="(min-width:1408px) 1328px, 100vw"
                className="aspect-[16/8] w-full"
              />
            </div>
          </div>
        )}
        <Section tone="paper" aria-label="Article">
          <div className="mx-auto max-w-[44rem]">
            <RichText html={post.contentHtml} className="text-ink/85" />
            {(post.authorName || post.authorBio) && (
              <aside aria-label="About the author" className="mt-14 border-t border-ink/15 pt-8">
                <p className="eyebrow text-smoke">Written by</p>
                <p className="mt-2 font-display text-lg font-bold uppercase">
                  {post.authorUrl ? (
                    <a href={post.authorUrl} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">
                      {post.authorName}
                    </a>
                  ) : (
                    post.authorName
                  )}
                </p>
                {post.authorBio && <p className="mt-2 text-sm text-smoke">{post.authorBio}</p>}
              </aside>
            )}
          </div>
        </Section>
      </article>
      {related.length > 0 && (
        <Section tone="mist" aria-labelledby="related-title">
          <h2 id="related-title" className="display-lg">
            Keep reading
          </h2>
          <ul className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <li key={p.id}>
                <PostCard post={p} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      <CtaBand whatsappHref={whatsappHref} tone="charcoal" />
    </>
  );
}
