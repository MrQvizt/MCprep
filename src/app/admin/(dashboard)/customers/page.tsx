import Link from "next/link";
import { Search, Users } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { customerStatus, listCustomers } from "@/lib/admin/customers";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { formatPhone } from "@/lib/identity";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { Pagination } from "../orders/order-ui";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin(AREA_ROLES.customers);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 120) : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const [{ items, total, pages }, settings] = await Promise.all([listCustomers({ q, page }), getSettings()]);
  const tz = settings.business.timeZone;
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Everyone who has sent an order request. Customers are matched by email and phone number, so repeat orders are grouped together."
      />
      <form method="get" role="search" className="mb-5 flex max-w-xl gap-2">
        <div className="relative flex-1">
          <label htmlFor="q" className="sr-only">
            Search customers
          </label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="q" name="q" defaultValue={q} placeholder="Name, email, phone or order reference" className="h-9 pl-8" />
        </div>
        <Button type="submit" className="h-9">
          Search
        </Button>
        {q && (
          <Button asChild variant="ghost" className="h-9">
            <Link href="/admin/customers">Reset</Link>
          </Button>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={q ? Search : Users}
          title={q ? "No customers match your search" : "No customers yet"}
          description={q ? undefined : "Customers are created automatically when someone submits an order request."}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden pr-4 lg:table-cell">Last order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => {
                  const status = customerStatus(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-64 pl-4">
                        <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{c.email ?? "—"}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{c.phone ? formatPhone(c.phone) : "—"}</TableCell>
                      <TableCell className="text-right tabular">{c._count.orders}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </TableCell>
                      <TableCell className="hidden pr-4 text-sm text-muted-foreground lg:table-cell">
                        {c.lastOrderAt ? formatDateTime(c.lastOrderAt, tz, { dateStyle: "medium" }) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pages={pages} total={total} hrefFor={href} noun="customers" />
        </>
      )}
    </>
  );
}
