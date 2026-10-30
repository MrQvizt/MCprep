import Link from "next/link";
import { Download, Inbox, Search, X } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";
import { NativeSelect } from "@/components/admin/form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ELIGIBILITY_FILTERS,
  hasActiveFilters,
  listOrders,
  orderQueueCounts,
  type OrderListItem,
  orderFiltersToQuery,
  parseOrderFilters,
  type OrderFilters,
} from "@/lib/admin/orders";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { FULFILLMENT_LABELS, ORDER_STATUSES, ORDER_STATUS_LABELS, paymentMethodLabel } from "@/lib/orders/labels";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { EligibilityBadge, OrderStatusBadge, Pagination, PaymentBadge } from "./order-ui";
import { ConfirmOrderButton, MarkPaidMenu } from "./payment-actions";

/** Confirm / mark paid without opening the order. */
function RowActions({ order }: { order: Pick<OrderListItem, "id" | "status" | "paymentStatus"> }) {
  const canConfirm = order.status === "NEW" || order.status === "CONTACTED";
  const canPay = order.status !== "CANCELLED" && order.paymentStatus !== "PAID";
  if (!canConfirm && !canPay) return null;
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-4 md:flex-col md:items-stretch md:p-0">
      {canConfirm && <ConfirmOrderButton orderId={order.id} />}
      {canPay && <MarkPaidMenu orderId={order.id} size="sm" />}
    </div>
  );
}

export const metadata = { title: "Orders" };

const QUICK_TABS: { label: string; filters: Partial<OrderFilters> }[] = [
  { label: "To confirm", filters: { queue: "to_confirm" } },
  { label: "Unpaid", filters: { queue: "unpaid" } },
  { label: "All", filters: {} },
  { label: "New request", filters: { status: "NEW" } },
  { label: "Awaiting confirmation", filters: { status: "CONTACTED" } },
  { label: "Confirmed", filters: { status: "CONFIRMED" } },
  { label: "In preparation", filters: { status: "IN_PREPARATION" } },
  { label: "Completed", filters: { status: "COMPLETED" } },
  { label: "Cancelled", filters: { status: "CANCELLED" } },
  { label: "Promotion to review", filters: { eligibility: "needs_review" } },
];


export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin(AREA_ROLES.orders);
  const filters = parseOrderFilters(await searchParams);
  const settings = await getSettings();
  const tz = settings.business.timeZone;
  const [{ items, total, pages }, statusCounts, queueCounts, promotion, customer] = await Promise.all([
    listOrders(filters, tz),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    orderQueueCounts(),
    filters.promotion ? db.promotion.findUnique({ where: { id: filters.promotion }, select: { name: true } }) : null,
    filters.customer ? db.customer.findUnique({ where: { id: filters.customer }, select: { name: true } }) : null,
  ]);
  const countFor = (s: string) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;
  const allCount = statusCounts.reduce((sum, c) => sum + c._count._all, 0);
  const query = orderFiltersToQuery(filters, { page: 1 });
  const hrefWith = (overrides: Partial<OrderFilters>) => {
    const qs = orderFiltersToQuery(filters, overrides);
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  };
  const isTabActive = (tab: Partial<OrderFilters>) =>
    (tab.status ?? "") === filters.status && (tab.eligibility ?? "") === filters.eligibility && (tab.queue ?? "") === filters.queue;

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Every order request from the website. Contact the customer, agree the details and update the status as you go."
        actions={
          allCount > 0 ? (
            <Button asChild variant="outline" size="lg">
              <a href={`/api/admin/orders/export${query ? `?${query}` : ""}`}>
                <Download className="size-4" /> Export CSV
              </a>
            </Button>
          ) : null
        }
      />

      <nav aria-label="Quick filters" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
        {QUICK_TABS.map((tab) => {
          const active = isTabActive(tab.filters);
          const count = tab.filters.queue
            ? queueCounts[tab.filters.queue]
            : tab.filters.status
              ? countFor(tab.filters.status)
              : tab.filters.eligibility
                ? null
                : allCount;
          return (
            <Link
              key={tab.label}
              href={hrefWith({
                ...tab.filters,
                queue: tab.filters.queue ?? "",
                status: tab.filters.status ?? "",
                eligibility: tab.filters.eligibility ?? "",
                page: 1,
              })}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${active ? "border-ink bg-ink text-white" : "bg-background hover:bg-muted"}`}
            >
              {tab.label}
              {count !== null && <span className={`tabular text-xs ${active ? "text-white/70" : "text-muted-foreground"}`}>{count}</span>}
            </Link>
          );
        })}
      </nav>

      <form method="get" className="mb-5 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6" role="search" aria-label="Filter orders">
        <div className="relative sm:col-span-2">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="q" name="q" defaultValue={filters.q} placeholder="Name, email, phone or reference" className="h-9 pl-8" />
        </div>
        <NativeSelect name="status" defaultValue={filters.status} aria-label="Status">
          <option value="">Any status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="eligibility" defaultValue={filters.eligibility} aria-label="Promotion">
          <option value="">Any promotion</option>
          {Object.entries(ELIGIBILITY_FILTERS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="fulfillment" defaultValue={filters.fulfillment} aria-label="Collection or delivery">
          <option value="">Collect / deliver</option>
          <option value="COLLECTION">Collection</option>
          <option value="DELIVERY">Delivery</option>
        </NativeSelect>
        <div className="flex items-center gap-2 lg:col-span-1">
          <Button type="submit" className="h-9 flex-1">
            Apply
          </Button>
          {hasActiveFilters(filters) && (
            <Button asChild variant="ghost" className="h-9">
              <Link href="/admin/orders">Reset</Link>
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2 lg:col-span-6">
          <label htmlFor="from" className="text-muted-foreground">
            From
          </label>
          <Input id="from" type="date" name="from" defaultValue={filters.from} className="h-9 w-auto" />
          <label htmlFor="to" className="text-muted-foreground">
            to
          </label>
          <Input id="to" type="date" name="to" defaultValue={filters.to} className="h-9 w-auto" />
          <span className="text-xs text-muted-foreground">Malta time</span>
          {filters.queue && <input type="hidden" name="queue" value={filters.queue} />}
          {filters.promotion && <input type="hidden" name="promotion" value={filters.promotion} />}
          {filters.customer && <input type="hidden" name="customer" value={filters.customer} />}
        </div>
      </form>

      {(promotion || customer) && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {promotion && (
            <Link href={hrefWith({ promotion: "", page: 1 })} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-white">
              Promotion: {promotion.name} <X className="size-3.5" aria-label="Remove filter" />
            </Link>
          )}
          {customer && (
            <Link href={hrefWith({ customer: "", page: 1 })} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-white">
              Customer: {customer.name} <X className="size-3.5" aria-label="Remove filter" />
            </Link>
          )}
        </div>
      )}

      {items.length === 0 ? (
        allCount === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No orders yet"
            description="When someone submits the order form on your website, their request appears here and you get an email."
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No orders match these filters"
            action={
              <Button asChild variant="outline">
                <Link href="/admin/orders">Clear filters</Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-3 md:hidden">
            {items.map((o) => (
              <li key={o.id} className="rounded-xl border bg-card hover:border-ink">
                <Link href={`/admin/orders/${o.id}`} className="block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{o.reference}</p>
                      <p className="truncate font-medium">{o.customerName}</p>
                      <p className="text-sm text-muted-foreground">{o.planName}</p>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold tabular">
                      {o.confirmedTotalCents !== null
                        ? formatMoney(o.confirmedTotalCents, o.currency)
                        : o.totalCents !== null
                          ? formatMoney(o.totalCents, o.currency)
                          : "Price on request"}
                    </span>
                    <PaymentBadge status={o.paymentStatus} />
                    <EligibilityBadge status={o.eligibilityStatus} />
                    <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(o.createdAt, tz)}</span>
                  </div>
                </Link>
                <RowActions order={o} />
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status &amp; payment</TableHead>
                  <TableHead className="pr-4">
                    <span className="sr-only">Quick actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((o) => (
                  <TableRow key={o.id} className="align-top">
                    <TableCell className="pl-4">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm font-semibold hover:underline">
                        {o.reference}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(o.createdAt, tz)}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {o.isPotentialDuplicate && <StatusBadge tone="warn">Possible duplicate</StatusBadge>}
                        {o.isReturningCustomer && <StatusBadge tone="info">Returning</StatusBadge>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56">
                      <p className="truncate font-medium">{o.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">{o.customerEmail}</p>
                    </TableCell>
                    <TableCell className="max-w-52 whitespace-normal">
                      <p>{o.planName}</p>
                      <p className="text-xs text-muted-foreground">
                        {FULFILLMENT_LABELS[o.fulfillmentMethod]}
                        {o.deliveryLocality ? ` · ${o.deliveryLocality}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-40 whitespace-normal text-right tabular">
                      {o.confirmedTotalCents !== null ? (
                        <>
                          <p className="font-semibold">{formatMoney(o.confirmedTotalCents, o.currency)}</p>
                          <p className="text-xs text-muted-foreground">agreed</p>
                        </>
                      ) : o.totalCents !== null ? (
                        <p className="font-semibold">{formatMoney(o.totalCents, o.currency)}</p>
                      ) : (
                        <p className="text-muted-foreground">On request</p>
                      )}
                      {o.promotionName && <p className="text-xs text-muted-foreground">incl. {o.promotionName}</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <OrderStatusBadge status={o.status} />
                        <PaymentBadge status={o.paymentStatus} method={paymentMethodLabel(o.paymentProvider)} />
                        <EligibilityBadge status={o.eligibilityStatus} />
                      </div>
                    </TableCell>
                    <TableCell className="w-px pr-4">
                      <RowActions order={o} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={filters.page}
            pages={pages}
            total={total}
            hrefFor={(page) => hrefWith({ page })}
          />
        </>
      )}
    </>
  );
}
