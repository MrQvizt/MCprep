import Image from "next/image";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { MEDIA_CATEGORY_NAMES, isOversized } from "@/lib/admin/media";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { findMediaUsage } from "@/lib/media";
import { formatDateTime } from "@/lib/time";
import { removeMedia } from "../actions";
import { MediaDetailsForm } from "../details-form";
import { ReplaceFile } from "../media-client";

export const metadata = { title: "Image" };

export default async function MediaDetailPage({ params }: PageProps<"/admin/media/[id]">) {
  await requireAdmin(AREA_ROLES.media);
  const { id } = await params;
  const media = await db.mediaAsset.findUnique({ where: { id }, include: { uploadedBy: { select: { name: true } } } });
  if (!media) notFound();
  const usage = await findMediaUsage(id);

  return (
    <>
      <AdminPageHeader
        title={media.altText || media.filename}
        back={{ href: "/admin/media", label: "Media library" }}
        actions={
          <>
            <ReplaceFile id={media.id} />
            {usage.length === 0 && (
              <ConfirmAction
                action={removeMedia.bind(null, media.id)}
                title="Delete this image?"
                description="It isn't used anywhere on the website. The file will be removed permanently."
                confirmLabel="Delete"
                destructive
                variant="outline"
              >
                <Trash2 className="size-4" /> Delete
              </ConfirmAction>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden rounded-xl border bg-muted" style={{ aspectRatio: media.width && media.height ? `${media.width}/${media.height}` : "4/3" }}>
          <Image src={media.url} alt={media.altText ?? ""} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" />
        </div>
        <div className="space-y-6">
          <AdminCard title="Details">
            <MediaDetailsForm media={media} categories={MEDIA_CATEGORY_NAMES} />
          </AdminCard>
          <AdminCard title="Where it's used">
            {usage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not used anywhere — safe to delete.</p>
            ) : (
              <>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {usage.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">To delete this image, remove it from these places first. “Replace file” updates it everywhere at once.</p>
              </>
            )}
          </AdminCard>
          <AdminCard title="File">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">File name</dt>
              <dd className="truncate">{media.filename}</dd>
              <dt className="text-muted-foreground">Size</dt>
              <dd>
                {media.width}×{media.height}px · {Math.round(media.sizeBytes / 1024)} KB{" "}
                {isOversized(media) && <StatusBadge tone="warn">Large</StatusBadge>}
              </dd>
              <dt className="text-muted-foreground">Category</dt>
              <dd>{MEDIA_CATEGORY_NAMES[media.category]}</dd>
              <dt className="text-muted-foreground">Uploaded</dt>
              <dd>
                {formatDateTime(media.createdAt)}
                {media.uploadedBy ? ` by ${media.uploadedBy.name}` : ""}
              </dd>
              {media.isPlaceholder && (
                <>
                  <dt className="text-muted-foreground">Note</dt>
                  <dd>
                    <StatusBadge tone="warn">Placeholder artwork — replace with a real photo</StatusBadge>
                  </dd>
                </>
              )}
            </dl>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
