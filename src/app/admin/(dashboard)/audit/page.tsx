import Link from "next/link";
import { History } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";
import { NativeSelect } from "@/components/admin/form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { entityHref, entityLabel } from "@/lib/admin/audit-view";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSettings } from "@/lib/settings";
import { addDaysToDateString, formatDateTime, zonedLocalToUtc } from "@/lib/time";

export const metadata = { title: "Activity log" };

const PAGE_SIZE = 50;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin(AREA_ROLES.audit);
  const sp = await searchParams;
  const settings = await getSettings();
  const tz = settings.business.timeZone;

  const entity = param(sp.entity);
  const actor = param(sp.actor);
  const q = param(sp.q).slice(0, 100);
  const from = DATE_RE.test(param(sp.from)) ? param(sp.from) : "";
  const to = DATE_RE.test(param(sp.to)) ? param(sp.to) : "";
  const page = Math.max(1, Number(param(sp.page)) || 1);

  const createdAt: Prisma.DateTimeFilter = {};
  if (from) {
    const start = zonedLocalToUtc(`${from}T00:00`, tz);
    if (start) createdAt.gte = start;
  }
  if (to) {
    const end = zonedLocalToUtc(`${addDaysToDateString(to, 1)}T00:00`, tz);
    if (end) createdAt.lt = end;
  }
  const where: Prisma.AuditLogWhereInput = {
    ...(entity ? { entityType: entity } : {}),
    ...(actor ? { actorId: actor } : {}),
    ...(q ? { summary: { contains: q, mode: "insensitive" } } : {}),
    ...(from || to ? { createdAt } : {}),
  };

  const [entries, total, entityTypes, actors] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["entityType"], _count: { _all: true }, orderBy: { entityType: "asc" } }),
    db.adminUser.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (entity) params.set("entity", entity);
    if (actor) params.set("actor", actor);
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("page", String(p));
    return `/admin/audit?${params}`;
  };
  const filtered = Boolean(entity || actor || q || from || to);

  return (
    <>
      <AdminPageHeader
        title="Activity log"
        description="Who changed what, and when. Every important change in the admin — prices, promotions, orders, settings and accounts — is recorded here."
      />

      <form method="get" className="mb-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <label className="space-y-1 text-sm lg:col-span-2">
          <span className="font-medium">Search</span>
          <Input name="q" defaultValue={q} placeholder="e.g. price, Halloween, MCP-000123" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Area</span>
          <NativeSelect name="entity" defaultValue={entity}>
            <option value="">All areas</option>
            {entityTypes.map((e) => (
              <option key={e.entityType} value={e.entityType}>
                {entityLabel(e.entityType)} ({e._count._all})
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Person</span>
          <NativeSelect name="actor" defaultValue={actor}>
            <option value="">Everyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">From</span>
          <Input type="date" name="from" defaultValue={from} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">To</span>
          <Input type="date" name="to" defaultValue={to} />
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit">Filter</Button>
          {filtered && (
            <Button asChild variant="ghost">
              <Link href="/admin/audit">Clear filters</Link>
            </Button>
          )}
          <span className="ml-auto self-center text-xs text-muted-foreground">Dates are Malta time.</span>
        </div>
      </form>

      {entries.length === 0 ? (
        <EmptyState icon={History} title={filtered ? "No matching activity" : "No activity yet"} description="Changes made in the admin will appear here." />
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {entries.map((e) => {
            const href = entityHref(e.entityType, e.entityId);
            const hasChanges = e.changes !== null && typeof e.changes === "object" && Object.keys(e.changes as object).length > 0;
            return (
              <li key={e.id} className="p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{e.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.actorEmail ?? "System"} · {formatDateTime(e.createdAt, tz)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge>{entityLabel(e.entityType)}</StatusBadge>
                    {href && (
                      <Link href={href} className="text-xs font-medium underline underline-offset-4">
                        Open
                      </Link>
                    )}
                  </div>
                </div>
                {hasChanges && (
                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">Show details</summary>
                    <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                      {JSON.stringify(e.changes, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link href={qs(page - 1)}>Newer</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page} of {pages} · {total} entries
          </span>
          {page < pages ? (
            <Button asChild variant="outline">
              <Link href={qs(page + 1)}>Older</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
