import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge, type Tone } from "@/components/admin/status-badge";
import { ELIGIBILITY_LABELS, ELIGIBILITY_TONES, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders/labels";
import { cn } from "@/lib/utils";

export const ORDER_STATUS_TONES: Record<string, Tone> = {
  NEW: "warn",
  CONTACTED: "info",
  CONFIRMED: "good",
  IN_PREPARATION: "dark",
  COMPLETED: "neutral",
  CANCELLED: "bad",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <StatusBadge tone={ORDER_STATUS_TONES[status] ?? "neutral"}>{ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status}</StatusBadge>;
}

export function EligibilityBadge({ status }: { status: string }) {
  if (status === "NOT_REQUIRED") return null;
  return <StatusBadge tone={ELIGIBILITY_TONES[status] ?? "neutral"}>{ELIGIBILITY_LABELS[status] ?? status}</StatusBadge>;
}

export function PaymentBadge({ status }: { status: string }) {
  const tone: Tone = status === "PAID" ? "good" : status === "FAILED" ? "bad" : status === "NOT_COLLECTED" ? "neutral" : "info";
  return <StatusBadge tone={tone}>{PAYMENT_STATUS_LABELS[status] ?? status}</StatusBadge>;
}

export function Pagination({
  page,
  pages,
  hrefFor,
  total,
  noun = "orders",
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
  total: number;
  noun?: string;
}) {
  if (total === 0) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {total} {total === 1 ? noun.replace(/s$/, "") : noun} · page {page} of {pages}
      </p>
      <div className="flex gap-2">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="Previous page">
          <ChevronLeft className="size-4" /> Previous
        </PageLink>
        <PageLink href={hrefFor(page + 1)} disabled={page >= pages} label="Next page">
          Next <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "inline-flex h-9 items-center gap-1 rounded-md border bg-background px-3 font-medium";
  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={label} className={cn(cls, "pointer-events-none opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cn(cls, "hover:bg-muted")}>
      {children}
    </Link>
  );
}

/** Label/value row used on detail pages. */
export function DetailRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className={cn("grid grid-cols-[minmax(0,9rem)_1fr] gap-3 py-2 text-sm", className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}
