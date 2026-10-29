import Image from "next/image";
import Link from "next/link";
import { Image as ImageIcon, Search } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEDIA_CATEGORIES, MEDIA_CATEGORY_NAMES, isOversized } from "@/lib/admin/media";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { MediaCategory, Prisma } from "@/generated/prisma/client";
import { MultiUpload } from "./media-client";

export const metadata = { title: "Media library" };

const PAGE_SIZE = 36;

export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  await requireAdmin(AREA_ROLES.media);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const category = typeof sp.category === "string" && (MEDIA_CATEGORIES as string[]).includes(sp.category) ? (sp.category as MediaCategory) : null;
  const filter = typeof sp.filter === "string" ? sp.filter : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.MediaAssetWhereInput = {
    ...(category ? { category } : {}),
    ...(q ? { OR: [{ filename: { contains: q, mode: "insensitive" } }, { altText: { contains: q, mode: "insensitive" } }] } : {}),
    ...(filter === "no-alt" ? { OR: [{ altText: null }, { altText: "" }] } : {}),
    ...(filter === "placeholder" ? { isPlaceholder: true } : {}),
  };
  const [items, total, missingAlt] = await Promise.all([
    db.mediaAsset.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.mediaAsset.count({ where }),
    db.mediaAsset.count({ where: { OR: [{ altText: null }, { altText: "" }] } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (params: Record<string, string | number | null>) => {
    const u = new URLSearchParams();
    const merged = { q, category, filter, page: 1, ...params };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === 1)) u.set(k, String(v));
    const s = u.toString();
    return `/admin/media${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        title="Media library"
        description="All your photos in one place. Images are checked, resized and compressed automatically when uploaded. Click an image to edit its description, replace it or delete it."
        actions={<MultiUpload />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="relative min-w-56 flex-1" action="/admin/media">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search by file name or description" className="pl-8" />
          {category && <input type="hidden" name="category" value={category} />}
        </form>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Link href={link({ category: null })} className={cn("rounded-full px-3 py-1 ring-1 ring-border", !category ? "bg-ink text-white ring-ink" : "bg-card")}>
            All
          </Link>
          {MEDIA_CATEGORIES.map((c) => (
            <Link key={c} href={link({ category: c })} className={cn("rounded-full px-3 py-1 ring-1 ring-border", category === c ? "bg-ink text-white ring-ink" : "bg-card")}>
              {MEDIA_CATEGORY_NAMES[c]}
            </Link>
          ))}
        </div>
      </div>
      {missingAlt > 0 && (
        <p className="mb-4 text-sm">
          <Link href={link({ filter: filter === "no-alt" ? null : "no-alt" })} className="text-amber-800 underline-offset-4 hover:underline">
            {filter === "no-alt" ? "Show all images" : `${missingAlt} image(s) have no description (alt text) — show them`}
          </Link>
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No images found" description="Upload photos of your meals, kitchen and team. Real photos build trust." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/media/${m.id}`} className="group block overflow-hidden rounded-lg border bg-card focus-visible:ring-3 focus-visible:ring-ring/40">
                <div className="relative aspect-square bg-muted">
                  <Image src={m.url} alt={m.altText ?? ""} fill sizes="200px" className="object-cover transition-transform group-hover:scale-105" />
                  <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                    {!m.altText && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-900">No alt text</span>}
                    {m.isPlaceholder && <span className="rounded bg-ink px-1.5 py-0.5 text-[0.6rem] font-semibold text-white">Placeholder</span>}
                    {isOversized(m) && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[0.6rem] font-semibold text-red-800">Large file</span>}
                  </div>
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium">{m.altText || m.filename}</p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    {MEDIA_CATEGORY_NAMES[m.category]} · {Math.round(m.sizeBytes / 1024)} KB
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <Button asChild variant="outline" disabled={page <= 1}>
            <Link href={link({ page: Math.max(1, page - 1) })} aria-disabled={page <= 1}>
              Previous
            </Link>
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {pages} · {total} images
          </span>
          <Button asChild variant="outline">
            <Link href={link({ page: Math.min(pages, page + 1) })} aria-disabled={page >= pages}>
              Next
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
