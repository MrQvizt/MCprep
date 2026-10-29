import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, RotateCcw } from "lucide-react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { CONTENT_FIELDS, CONTENT_VIEW_PATHS, isContentKey, mediaFieldNames } from "@/lib/admin/content-fields";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { CONTENT_LABELS, getContent } from "@/lib/content";
import { db } from "@/lib/db";
import { getMediaMap } from "@/lib/media";
import { formatDateTime } from "@/lib/time";
import { resetContentBlock } from "../actions";
import { ContentEditor } from "./content-editor";

export const metadata = { title: "Edit content" };

export default async function EditContentPage({ params }: PageProps<"/admin/content/[key]">) {
  await requireAdmin(AREA_ROLES.content);
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  if (!isContentKey(key)) notFound();
  const [content, row] = await Promise.all([getContent(key), db.pageContent.findUnique({ where: { key }, select: { updatedAt: true } })]);
  const value = content as Record<string, unknown>;
  const media = await getMediaMap(mediaFieldNames(key).map((n) => value[n] as string | null));
  const mediaRefs = Object.fromEntries(media);
  const isLegal = key.startsWith("legal.");

  return (
    <>
      <AdminPageHeader
        title={CONTENT_LABELS[key]}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {row ? <StatusBadge tone="info">Customised · {formatDateTime(row.updatedAt)}</StatusBadge> : <StatusBadge>Default text</StatusBadge>}
            {isLegal && !value.reviewedByOwner && <StatusBadge tone="warn">Needs review before launch</StatusBadge>}
          </span>
        }
        back={{ href: "/admin/content", label: "All content" }}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={CONTENT_VIEW_PATHS[key]} target="_blank">
                <ExternalLink className="size-4" /> View on site
              </Link>
            </Button>
            {row && (
              <ConfirmAction
                action={resetContentBlock.bind(null, key)}
                title="Restore the default text?"
                description="Your changes to this section will be replaced by the original text."
                confirmLabel="Restore default"
                variant="outline"
              >
                <RotateCcw className="size-4" /> Reset to default
              </ConfirmAction>
            )}
          </>
        }
      />
      {isLegal && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This is a template, not legal advice. Replace every item in [square brackets] with your real details and have it reviewed by a
          qualified adviser before launch.
        </p>
      )}
      <ContentEditor key={row?.updatedAt.toISOString() ?? "default"} contentKey={key} fields={CONTENT_FIELDS[key]} initial={value} mediaRefs={mediaRefs} />
    </>
  );
}
