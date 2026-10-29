import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Eye, EyeOff, Home, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DemoBadge, StatusBadge } from "@/components/admin/status-badge";
import { InstagramIcon } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { getSettingsGroup } from "@/lib/settings";
import { moveGallery, removeGalleryItem, toggleGallery } from "./actions";
import { BulkAddGallery } from "./bulk-add";

export const metadata = { title: "Instagram gallery" };

export default async function GalleryAdminPage() {
  await requireAdmin(AREA_ROLES.gallery);
  const [items, contact] = await Promise.all([
    db.galleryItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], include: { mediaAsset: true } }),
    getSettingsGroup("contact"),
  ]);
  const featured = items.filter((i) => i.isPublished && i.isFeatured).length;

  return (
    <>
      <AdminPageHeader
        title="Instagram gallery"
        description={
          <>
            Upload your Instagram photos here — nothing connects to Instagram itself. Each photo can link to its Instagram post, or to your
            profile ({contact.instagramHandle ? `@${contact.instagramHandle}` : "set it in Business settings"}). {featured} photo(s) currently
            shown on the homepage.
          </>
        }
        actions={
          <>
            <BulkAddGallery />
            <Button asChild size="lg">
              <Link href="/admin/gallery/new">
                <Plus className="size-4" /> Add photo
              </Link>
            </Button>
          </>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={InstagramIcon} title="No gallery photos yet" description="Add the photos you post on Instagram to show them on your website." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <li key={item.id} className="overflow-hidden rounded-xl border bg-card">
              <div className="relative aspect-square bg-muted">
                <Image src={item.mediaAsset.url} alt={item.altText ?? item.mediaAsset.altText ?? ""} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover" />
                <span className="absolute left-2 top-2 rounded bg-ink/80 px-2 py-0.5 text-xs font-semibold text-white tabular">#{i + 1}</span>
              </div>
              <div className="space-y-2 p-3">
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone={item.isPublished ? "good" : "neutral"}>{item.isPublished ? "Shown" : "Hidden"}</StatusBadge>
                  {item.isFeatured && item.isPublished && <StatusBadge tone="info">Homepage</StatusBadge>}
                  {item.isDemo && <DemoBadge />}
                  {item.mediaAsset.isPlaceholder && <StatusBadge tone="warn">Placeholder image</StatusBadge>}
                </div>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <Link2 className="size-3.5 shrink-0" />
                  {item.instagramUrl ? item.instagramUrl.replace(/^https?:\/\/(www\.)?/, "") : "Links to your Instagram profile"}
                </p>
                {!(item.altText || item.mediaAsset.altText) && <p className="text-xs text-amber-700">Add a description (alt text)</p>}
                <div className="flex flex-wrap items-center gap-1 border-t pt-2">
                  <ActionButton action={moveGallery.bind(null, item.id, "up")} label="Move earlier" disabled={i === 0}>
                    <ArrowUp className="size-4" />
                  </ActionButton>
                  <ActionButton action={moveGallery.bind(null, item.id, "down")} label="Move later" disabled={i === items.length - 1}>
                    <ArrowDown className="size-4" />
                  </ActionButton>
                  <ActionButton action={toggleGallery.bind(null, item.id, "isPublished")} label={item.isPublished ? "Hide" : "Show"}>
                    {item.isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </ActionButton>
                  <ActionButton action={toggleGallery.bind(null, item.id, "isFeatured")} label={item.isFeatured ? "Remove from homepage" : "Show on homepage"}>
                    <Home className={item.isFeatured ? "size-4" : "size-4 opacity-40"} />
                  </ActionButton>
                  <Button asChild variant="ghost" size="icon-sm" aria-label="Edit">
                    <Link href={`/admin/gallery/${item.id}`}>
                      <Pencil className="size-4" />
                    </Link>
                  </Button>
                  <ConfirmAction
                    action={removeGalleryItem.bind(null, item.id)}
                    title="Remove this photo from the gallery?"
                    description="The image stays in your media library."
                    confirmLabel="Remove"
                    variant="ghost"
                    size="icon-sm"
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove</span>
                  </ConfirmAction>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
