import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { blogVisibility, getInternalLinkSuggestions } from "@/lib/admin/blog";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { BlogForm } from "../blog-form";
import { getEditorContext } from "../editor-data";

export const metadata = { title: "Edit article" };

const media = (m: { id: string; url: string; altText: string | null; width: number | null; height: number | null } | null) =>
  m ? { id: m.id, url: m.url, altText: m.altText, width: m.width, height: m.height } : null;

export default async function EditBlogPostPage({ params }: PageProps<"/admin/blog/[id]">) {
  await requireAdmin(AREA_ROLES.blog);
  const { id } = await params;
  const post = await db.blogPost.findUnique({ where: { id }, include: { coverImage: true, ogImage: true } });
  if (!post) notFound();
  const [ctx, suggestions] = await Promise.all([
    getEditorContext(),
    getInternalLinkSuggestions({ id: post.id, slug: post.slug, title: post.title, primaryTopic: post.primaryTopic, contentHtml: post.contentHtml }),
  ]);
  const visibility = blogVisibility(post);
  return (
    <>
      <AdminPageHeader title={post.title} description="Edit the article, then save, publish or schedule it." back={{ href: "/admin/blog", label: "All articles" }} />
      <BlogForm
        key={post.updatedAt.toISOString()}
        {...ctx}
        suggestions={suggestions}
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          contentHtml: post.contentHtml,
          coverImage: media(post.coverImage),
          coverAlt: post.coverAlt,
          categoryId: post.categoryId,
          authorName: post.authorName,
          authorBio: post.authorBio,
          authorUrl: post.authorUrl,
          isFeatured: post.isFeatured,
          needsReview: post.needsReview,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          primaryTopic: post.primaryTopic,
          ogTitle: post.ogTitle,
          ogDescription: post.ogDescription,
          ogImage: media(post.ogImage),
          canonicalUrl: post.canonicalUrl,
          noindex: post.noindex,
          visibility,
          publishAt: post.publishAt,
          publishAtLabel: post.publishAt ? formatDateTime(post.publishAt) : null,
          contentUpdatedAtLabel: formatDateTime(post.contentUpdatedAt),
          previewUrl: post.previewToken ? `/blog/${post.slug}?preview=${post.previewToken}` : null,
        }}
      />
    </>
  );
}
