import Link from "next/link";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Quote, Trash2 } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/time";
import { moveTestimonial, removeTestimonial, toggleTestimonial } from "./actions";

export const metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  await requireAdmin(AREA_ROLES.testimonials);
  const items = await db.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return (
    <>
      <AdminPageHeader
        title="Testimonials"
        description="Only publish genuine testimonials with the customer's permission. Never write reviews yourself or edit what customers said."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/testimonials/new">
              <Plus className="size-4" /> Add testimonial
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Quote}
          title="No testimonials yet"
          description="When a customer sends you kind words, ask if you can share them — then add them here with the date they agreed."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((t, i) => (
            <li key={t.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm">“{t.quote}”</p>
                <p className="mt-1 text-sm font-medium">
                  — {t.displayName}
                  {t.context && <span className="font-normal text-muted-foreground">, {t.context}</span>}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge tone={t.isPublished ? "good" : "neutral"}>{t.isPublished ? "Published" : "Not published"}</StatusBadge>
                  {t.consentRecordedAt ? (
                    <StatusBadge tone="info">Permission {formatDate(t.consentRecordedAt)}</StatusBadge>
                  ) : (
                    <StatusBadge tone="warn">No permission recorded</StatusBadge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ActionButton action={moveTestimonial.bind(null, t.id, "up")} label="Move up" disabled={i === 0}>
                  <ArrowUp className="size-4" />
                </ActionButton>
                <ActionButton action={moveTestimonial.bind(null, t.id, "down")} label="Move down" disabled={i === items.length - 1}>
                  <ArrowDown className="size-4" />
                </ActionButton>
                <ActionButton action={toggleTestimonial.bind(null, t.id)} label={t.isPublished ? "Hide" : "Publish"}>
                  {t.isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </ActionButton>
                <Button asChild variant="ghost" size="icon-sm" aria-label="Edit">
                  <Link href={`/admin/testimonials/${t.id}`}>
                    <Pencil className="size-4" />
                  </Link>
                </Button>
                <ConfirmAction
                  action={removeTestimonial.bind(null, t.id)}
                  title="Delete this testimonial?"
                  confirmLabel="Delete"
                  destructive
                  variant="ghost"
                  size="icon-sm"
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Delete</span>
                </ConfirmAction>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
