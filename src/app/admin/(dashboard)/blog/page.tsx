import Link from "next/link";
import { FolderTree, Newspaper, Plus, Star } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { blogVisibility, countWords, THIN_CONTENT_WORDS } from "@/lib/admin/blog";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Blog" };

const FILTERS = [
  { key: "", label: "All" },
  { key: "published", label: "Published" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Drafts" },
  { key: "review", label: "Needs fact-check" },
] as const;

export default async function BlogListPage({ searchParams }: PageProps<"/admin/blog">) {
  await requireAdmin(AREA_ROLES.blog);
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const now = new Date();

  const [allPosts, categories] = await Promise.all([
    db.blogPost.findMany({
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishAt: true,
        needsReview: true,
        isFeatured: true,
        contentHtml: true,
        updatedAt: true,
        category: { select: { name: true, slug: true } },
      },
    }),
    db.blogCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);

  const posts = allPosts.filter((p) => {
    const v = blogVisibility(p, now);
    if (category && p.category?.slug !== category) return false;
    if (status === "published") return v === "PUBLISHED";
    if (status === "scheduled") return v === "SCHEDULED";
    if (status === "draft") return v === "DRAFT";
    if (status === "review") return p.needsReview;
    return true;
  });

  const href = (s: string, c: string) => {
    const q = new URLSearchParams();
    if (s) q.set("status", s);
    if (c) q.set("category", c);
    const qs = q.toString();
    return `/admin/blog${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        title="Blog"
        description="Useful articles about meal prep and eating well in Malta help people find you on Google. Drafts must be fact-checked before they can be published."
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/admin/blog/categories">
                <FolderTree className="size-4" /> Categories
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/admin/blog/new">
                <Plus className="size-4" /> New article
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href(f.key, category)}
            className={cn("rounded-full border px-3 py-1 text-sm", status === f.key ? "border-ink bg-ink text-white" : "bg-card hover:border-ink")}
          >
            {f.label}
          </Link>
        ))}
        {categories.length > 0 && (
          <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Category:</span>
            <Link href={href(status, "")} className={cn("hover:underline", !category && "font-semibold")}>
              Any
            </Link>
            {categories.map((c) => (
              <Link key={c.id} href={href(status, c.slug)} className={cn("hover:underline", category === c.slug && "font-semibold")}>
                {c.name}
              </Link>
            ))}
          </span>
        )}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={allPosts.length === 0 ? "No articles yet" : "No articles match this filter"}
          description="Write about what you know: meal prep tips, how to read macros, eating well around work and training in Malta."
          action={
            <Button asChild>
              <Link href="/admin/blog/new">Write an article</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-72">Article</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Publish date</TableHead>
                <TableHead className="text-right">Words</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p) => {
                const v = blogVisibility(p, now);
                const words = countWords(p.contentHtml);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-normal">
                      <Link href={`/admin/blog/${p.id}`} className="font-medium hover:underline">
                        {p.isFeatured && <Star className="mr-1 inline size-3.5 fill-current" aria-label="Featured" />}
                        {p.title}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">/blog/{p.slug}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge tone={v === "PUBLISHED" ? "good" : v === "SCHEDULED" ? "info" : "neutral"}>
                          {v === "PUBLISHED" ? "Published" : v === "SCHEDULED" ? "Scheduled" : "Draft"}
                        </StatusBadge>
                        {p.needsReview && <StatusBadge tone="warn">Needs fact-check</StatusBadge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.category?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{p.publishAt && p.status === "PUBLISHED" ? formatDateTime(p.publishAt) : "—"}</TableCell>
                    <TableCell className={cn("text-right tabular text-sm", words < THIN_CONTENT_WORDS && "text-amber-700")}>{words}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(p.updatedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
