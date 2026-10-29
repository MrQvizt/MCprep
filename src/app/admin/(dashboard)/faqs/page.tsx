import Link from "next/link";
import { ArrowDown, ArrowUp, Eye, EyeOff, HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DemoBadge, StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { deleteFaq, moveFaq, toggleFaqPublished } from "./actions";

export const metadata = { title: "FAQs" };

export default async function FaqsPage() {
  await requireAdmin(AREA_ROLES.faqs);
  const faqs = await db.fAQ.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });

  return (
    <>
      <AdminPageHeader
        title="FAQs"
        description="Questions and answers shown on the FAQ page and the homepage. Use the arrows to change the order."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/faqs/new">
              <Plus className="size-4" /> New FAQ
            </Link>
          </Button>
        }
      />
      {faqs.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No FAQs yet"
          description="Answer the questions customers ask most — about ordering, delivery, allergies and payment."
          action={
            <Button asChild>
              <Link href="/admin/faqs/new">Add your first FAQ</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {faqs.map((faq, i) => (
            <li key={faq.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/faqs/${faq.id}`} className="font-medium hover:underline">
                    {faq.question}
                  </Link>
                  {faq.isDemo && <DemoBadge />}
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{faq.answer}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge tone={faq.isPublished ? "good" : "neutral"}>{faq.isPublished ? "Published" : "Hidden"}</StatusBadge>
                  {faq.showOnHomepage && <StatusBadge tone="info">Homepage</StatusBadge>}
                  {faq.category && <StatusBadge>{faq.category}</StatusBadge>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ActionButton action={moveFaq.bind(null, faq.id, "up")} label="Move up" disabled={i === 0}>
                  <ArrowUp className="size-4" />
                </ActionButton>
                <ActionButton action={moveFaq.bind(null, faq.id, "down")} label="Move down" disabled={i === faqs.length - 1}>
                  <ArrowDown className="size-4" />
                </ActionButton>
                <ActionButton action={toggleFaqPublished.bind(null, faq.id)} label={faq.isPublished ? "Hide" : "Publish"}>
                  {faq.isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </ActionButton>
                <Button asChild variant="ghost" size="icon-sm" aria-label="Edit">
                  <Link href={`/admin/faqs/${faq.id}`}>
                    <Pencil className="size-4" />
                  </Link>
                </Button>
                <ConfirmAction
                  action={deleteFaq.bind(null, faq.id)}
                  title="Delete this FAQ?"
                  description="It will be removed from the website straight away. This can't be undone."
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
