import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  ImagePlus,
  Inbox,
  MailWarning,
  Newspaper,
  Rocket,
  Tags,
  Timer,
  Utensils,
} from "lucide-react";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Countdown } from "@/components/shared/countdown";
import { Button } from "@/components/ui/button";
import { getOrderKpis } from "@/lib/admin/growth";
import { hasRole, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/orders/labels";
import { discountLabel } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { OrderStatusBadge } from "./orders/order-ui";

export const metadata = { title: "Dashboard" };

function Kpi({ label, value, href, hint, highlight }: { label: string; value: number; href: string; hint?: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`group rounded-xl border p-5 transition-colors hover:border-ink ${highlight ? "border-ink bg-ink text-white" : "bg-card"}`}
    >
      <p className="font-display text-3xl font-extrabold tabular">{value.toLocaleString("en-GB")}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {hint && <p className={`mt-0.5 text-xs ${highlight ? "text-white/70" : "text-muted-foreground"}`}>{hint}</p>}
    </Link>
  );
}

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin("EDITOR");
  const sp = await searchParams;
  const isAdmin = hasRole(admin.role, "ADMIN");
  const settings = await getSettings();
  const tz = settings.business.timeZone;
  const currency = settings.business.currency || "EUR";
  const now = new Date();

  const [recentMedia, demoCounts] = await Promise.all([
    db.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, url: true, altText: true, filename: true, createdAt: true, isPlaceholder: true },
    }),
    Promise.all([
      db.meal.count({ where: { isDemo: true, archivedAt: null } }),
      db.plan.count({ where: { isDemo: true, archivedAt: null } }),
      db.galleryItem.count({ where: { isDemo: true } }),
      db.fAQ.count({ where: { isDemo: true } }),
      db.promotion.count({ where: { isDemo: true } }),
      db.mediaAsset.count({ where: { isPlaceholder: true } }),
      db.plan.count({ where: { isActive: true, archivedAt: null, priceCents: null } }),
    ]),
  ]);
  const [demoMeals, demoPlans, demoGallery, demoFaqs, demoPromos, placeholderImages, plansWithoutPrice] = demoCounts;
  const demoItems = [
    demoPlans && `${demoPlans} sample plan${demoPlans === 1 ? "" : "s"}`,
    plansWithoutPrice && `${plansWithoutPrice} plan${plansWithoutPrice === 1 ? "" : "s"} without a price`,
    demoMeals && `${demoMeals} sample meal${demoMeals === 1 ? "" : "s"}`,
    demoGallery && `${demoGallery} placeholder gallery tile${demoGallery === 1 ? "" : "s"}`,
    demoFaqs && `${demoFaqs} sample FAQ${demoFaqs === 1 ? "" : "s"} to review`,
    demoPromos && `${demoPromos} example promotion${demoPromos === 1 ? "" : "s"}`,
    placeholderImages && !demoGallery && `${placeholderImages} placeholder image${placeholderImages === 1 ? "" : "s"}`,
    settings.site.showDemoNotice && "the “preview site” banner is still switched on",
  ].filter(Boolean) as string[];

  const orderData = isAdmin
    ? await Promise.all([
        getOrderKpis(now, tz),
        db.order.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, reference: true, customerName: true, planName: true, status: true, createdAt: true, totalCents: true, currency: true, promotionName: true },
        }),
        db.orderStatusHistory.findMany({
          where: { fromStatus: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
            changedBy: { select: { name: true } },
            order: { select: { id: true, reference: true } },
          },
        }),
        db.promotion.findMany({
          where: { isEnabled: true, startsAt: { lte: now }, endsAt: { gt: now } },
          orderBy: [{ priority: "desc" }, { endsAt: "asc" }],
          take: 3,
          include: { _count: { select: { orders: true } } },
        }),
        db.promotion.findFirst({ where: { isEnabled: true, startsAt: { gt: now } }, orderBy: { startsAt: "asc" } }),
        db.plan.findMany({
          where: { isActive: true, archivedAt: null },
          orderBy: [{ sortOrder: "asc" }, { durationDays: "asc" }],
          select: { id: true, name: true, priceCents: true, isRecommended: true, durationDays: true },
        }),
        db.emailOutbox.findMany({
          where: {
            OR: [{ status: { in: ["FAILED", "DEAD"] } }, { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 15 * 60_000) } }],
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, status: true, order: { select: { id: true, reference: true } } },
        }),
      ])
    : null;

  const livePromos = orderData?.[3] ?? [];
  const redemptionCounts =
    livePromos.length > 0
      ? await db.promotionRedemption.groupBy({
          by: ["promotionId", "status"],
          where: { promotionId: { in: livePromos.map((p) => p.id) } },
          _count: { _all: true },
        })
      : [];
  const redemptionsFor = (id: string, status: string) =>
    redemptionCounts.find((r) => r.promotionId === id && r.status === status)?._count._all ?? 0;

  return (
    <>
      <AdminPageHeader
        title={`Welcome back, ${admin.name.split(" ")[0]}`}
        description={`Here's what's happening with ${settings.business.tradingName} today.`}
      />

      {sp.denied === "1" && (
        <p role="alert" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Your account doesn&apos;t have access to that page. Ask the owner if you need it.
        </p>
      )}

      {demoItems.length > 0 && hasRole(admin.role, "ADMIN") && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center">
          <Rocket className="size-5 shrink-0" aria-hidden="true" />
          <p className="flex-1 text-sm">
            <strong>Before you launch:</strong> {demoItems.join(", ")}.
          </p>
          <Button asChild variant="outline" className="border-amber-400 bg-white">
            <Link href="/admin/launch">Open launch checklist</Link>
          </Button>
        </div>
      )}

      {orderData && orderData[6].length > 0 && (
        <div role="alert" className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-red-950">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MailWarning className="size-4" /> Some order emails haven&apos;t been delivered
          </p>
          <p className="mt-1 text-sm">
            Your orders are safe — they&apos;re saved here. The emails are retried automatically; open an order to retry now or check the email
            settings.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {[...new Map(orderData[6].filter((e) => e.order).map((e) => [e.order!.id, e.order!])).values()].map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="rounded-full bg-white px-2.5 py-1 font-mono text-xs font-semibold ring-1 ring-red-200 hover:ring-red-400">
                  {o.reference}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {orderData && (
        <section aria-label="Orders at a glance" className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
          <Kpi label="New — awaiting contact" value={orderData[0].new} href="/admin/orders?status=NEW" highlight={orderData[0].new > 0} hint="Reply to these first" />
          <Kpi label="Contacted" value={orderData[0].contacted} href="/admin/orders?status=CONTACTED" />
          <Kpi label="Confirmed" value={orderData[0].confirmed} href="/admin/orders?status=CONFIRMED" hint="Incl. in preparation" />
          <Kpi label="Promotion to review" value={orderData[0].needsReview} href="/admin/orders?eligibility=needs_review" />
          <Kpi label="This month" value={orderData[0].thisMonth} href="/admin/growth?period=month" />
          <Kpi label="All orders" value={orderData[0].total} href="/admin/orders" />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {orderData && (
            <AdminCard
              title="Latest order requests"
              actions={
                <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                  All orders <ArrowRight className="size-3.5" />
                </Link>
              }
            >
              {orderData[1].length === 0 ? (
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Inbox className="size-5 shrink-0" />
                  <p>No order requests yet. They appear here as soon as someone submits the order form, and you&apos;ll get an email too.</p>
                </div>
              ) : (
                <ul className="divide-y">
                  {orderData[1].map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm hover:bg-muted/40">
                        <span className="font-mono text-xs font-semibold">{o.reference}</span>
                        <span className="font-medium">{o.customerName}</span>
                        <span className="text-muted-foreground">
                          {o.planName}
                          {o.promotionName ? ` · ${o.promotionName}` : ""}
                        </span>
                        <span className="ml-auto flex items-center gap-2">
                          {o.totalCents !== null && <span className="tabular">{formatMoney(o.totalCents, o.currency)}</span>}
                          <OrderStatusBadge status={o.status} />
                        </span>
                        <span className="w-full text-xs text-muted-foreground">{formatDateTime(o.createdAt, tz)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          )}

          {orderData && orderData[2].length > 0 && (
            <AdminCard title="Recent activity">
              <ul className="space-y-3 text-sm">
                {orderData[2].map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-x-2">
                    <Link href={`/admin/orders/${h.order.id}`} className="font-mono text-xs font-semibold hover:underline">
                      {h.order.reference}
                    </Link>
                    <span>
                      {h.fromStatus && h.fromStatus !== h.toStatus
                        ? `${ORDER_STATUS_LABELS[h.fromStatus]} → ${ORDER_STATUS_LABELS[h.toStatus]}`
                        : "Note added"}
                    </span>
                    <span className="text-muted-foreground">
                      by {h.changedBy?.name ?? "former admin"} · {formatDateTime(h.createdAt, tz)}
                    </span>
                  </li>
                ))}
              </ul>
            </AdminCard>
          )}

          <AdminCard
            title="Recently uploaded images"
            actions={
              <Link href="/admin/media" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                Media library <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {recentMedia.length === 0 ? (
              <p className="text-sm text-muted-foreground">No images uploaded yet. Add real photos of your meals and kitchen in the Media library.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {recentMedia.map((m) => (
                  <li key={m.id} className="relative aspect-square overflow-hidden rounded-md border bg-muted" title={m.altText ?? m.filename}>
                    <Image src={m.url} alt={m.altText ?? ""} fill sizes="120px" className="object-cover" />
                    {m.isPlaceholder && (
                      <span className="absolute bottom-1 left-1 rounded bg-amber-100 px-1 text-[0.6rem] font-medium text-amber-900">Placeholder</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>

        <div className="space-y-6">
          {orderData && (
            <AdminCard
              title="Promotions"
              actions={
                <Link href="/admin/promotions" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                  Manage <ArrowRight className="size-3.5" />
                </Link>
              }
            >
              {livePromos.length === 0 ? (
                <div className="text-sm">
                  <p className="text-muted-foreground">No promotion is running right now.</p>
                  {orderData[4] && (
                    <p className="mt-2">
                      Next: <strong>{orderData[4].name}</strong> starts {formatDateTime(orderData[4].startsAt, tz)}.
                    </p>
                  )}
                </div>
              ) : (
                <ul className="space-y-5">
                  {livePromos.map((p) => (
                    <li key={p.id} className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone="good">Live</StatusBadge>
                        <Link href={`/admin/promotions/${p.id}`} className="font-semibold hover:underline">
                          {p.name}
                        </Link>
                        <span className="text-sm text-muted-foreground">
                          {discountLabel(p, currency)}
                          {p.audience === "NEW_CUSTOMERS" ? " · first order" : ""}
                        </span>
                      </div>
                      <Countdown endsAt={p.endsAt.toISOString()} serverNow={now.toISOString()} size="sm" label="Ends in" refreshOnEnd={false} />
                      <p className="text-sm">
                        <Link href={`/admin/orders?promotion=${p.id}`} className="underline underline-offset-4">
                          {p._count.orders} order request{p._count.orders === 1 ? "" : "s"}
                        </Link>
                        {" · "}
                        {redemptionsFor(p.id, "APPROVED")} approved · {redemptionsFor(p.id, "REQUESTED")} awaiting decision
                        {p.totalRedemptionLimit !== null && ` · limit ${p.totalRedemptionLimit}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          )}

          {orderData && (
            <AdminCard
              title="Active plans"
              actions={
                <Link href="/admin/plans" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                  Edit prices <ArrowRight className="size-3.5" />
                </Link>
              }
            >
              {orderData[5].length === 0 ? (
                <p className="text-sm text-muted-foreground">No active plans — customers can&apos;t order until you add one.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {orderData[5].map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span>
                        {p.name}
                        {p.isRecommended && <StatusBadge className="ml-2">Recommended</StatusBadge>}
                      </span>
                      {p.priceCents === null ? (
                        <span className="flex items-center gap-1 text-amber-800">
                          <AlertTriangle className="size-3.5" /> No price set
                        </span>
                      ) : (
                        <span className="font-semibold tabular">{formatMoney(p.priceCents, currency)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          )}

          <AdminCard title="Quick actions">
            <ul className="grid gap-2 text-sm">
              {[
                isAdmin && { href: "/admin/orders?status=NEW", label: "Reply to new orders", icon: Inbox },
                { href: "/admin/meals", label: "Add or edit meals", icon: Utensils },
                isAdmin && { href: "/admin/plans", label: "Change plan prices", icon: Tags },
                isAdmin && { href: "/admin/promotions", label: "Launch a promotion", icon: Timer },
                { href: "/admin/gallery", label: "Upload Instagram photos", icon: ImagePlus },
                { href: "/admin/blog", label: "Write a blog article", icon: Newspaper },
                isAdmin && { href: "/admin/growth", label: "See how the website is doing", icon: BadgePercent },
              ]
                .filter((a): a is { href: string; label: string; icon: typeof Inbox } => Boolean(a))
                .map((a) => (
                  <li key={a.href}>
                    <Link href={a.href} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:border-ink">
                      <a.icon className="size-4 text-muted-foreground" /> {a.label}
                      <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
            </ul>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
