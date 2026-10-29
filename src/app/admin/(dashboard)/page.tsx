import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ChefHat,
  CheckCircle2,
  FileText,
  HelpCircle,
  ImagePlus,
  Images,
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
import { getKitchenWeek, type KitchenWeek } from "@/lib/admin/kitchen";
import { orderQueueCounts } from "@/lib/admin/orders";
import { hasRole, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatShortDay, formatTime12, nextCutoff } from "@/lib/order-cutoff";
import { cutoffConfig } from "@/lib/order-cutoff-settings";
import { paymentMethodLabel } from "@/lib/orders/labels";
import { discountLabel } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { addDaysToDateString, formatDateTime, zonedDateString } from "@/lib/time";
import { cn } from "@/lib/utils";
import { OrderStatusBadge, PaymentBadge } from "./orders/order-ui";
import { ConfirmOrderButton, MarkPaidMenu } from "./orders/payment-actions";

export const metadata = { title: "Dashboard" };

const DAY_MS = 86_400_000;

function Kpi({ label, value, href, hint, tone = "plain" }: { label: string; value: number; href: string; hint?: string; tone?: "plain" | "urgent" }) {
  const urgent = tone === "urgent" && value > 0;
  return (
    <Link
      href={href}
      className={cn("group rounded-xl border p-5 transition-colors hover:border-ink", urgent ? "border-ink bg-ink text-white" : "bg-card")}
    >
      <p className="font-display text-3xl font-extrabold tabular">{value.toLocaleString("en-GB")}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {hint && <p className={cn("mt-0.5 text-xs", urgent ? "text-white/70" : "text-muted-foreground")}>{hint}</p>}
    </Link>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
      {children} <ArrowRight className="size-3.5" />
    </Link>
  );
}

/** Monday (YYYY-MM-DD) of the week containing `now`, in the business time zone. */
function mondayOf(now: Date, tz: string): string {
  const today = zonedDateString(now, tz);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDaysToDateString(today, -((dow + 6) % 7));
}

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin("EDITOR");
  const sp = await searchParams;
  const isAdmin = hasRole(admin.role, "ADMIN");
  const settings = await getSettings();
  const firstName = admin.name.split(" ")[0];

  const denied = sp.denied === "1" && (
    <p role="alert" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      Your account doesn&apos;t have access to that page. Ask the owner if you need it.
    </p>
  );

  if (!isAdmin) {
    return (
      <>
        <AdminPageHeader title={`Welcome back, ${firstName}`} description="What would you like to update on the website today?" />
        {denied}
        <EditorDashboard />
      </>
    );
  }
  return (
    <>
      <AdminPageHeader title={`Welcome back, ${firstName}`} description={`Here's what needs doing at ${settings.business.tradingName}.`} />
      {denied}
      <OwnerDashboard settings={settings} />
    </>
  );
}

// ── Owners and admins: orders first ─────────────────────────────────────────

async function OwnerDashboard({ settings }: { settings: Awaited<ReturnType<typeof getSettings>> }) {
  const tz = settings.business.timeZone;
  const currency = settings.business.currency || "EUR";
  const now = new Date();
  const f = settings.fulfillment;
  const cutoff = f.weeklyCutoffEnabled ? nextCutoff(now, cutoffConfig(f), tz) : null;
  const thisWeek = mondayOf(now, tz);
  const nextWeek = addDaysToDateString(thisWeek, 7);
  const going = ["CONFIRMED", "IN_PREPARATION", "COMPLETED"] as const;
  const listSelect = {
    id: true,
    reference: true,
    customerName: true,
    planName: true,
    status: true,
    paymentStatus: true,
    paymentProvider: true,
    createdAt: true,
    totalCents: true,
    confirmedTotalCents: true,
    currency: true,
  } as const;

  const [kpis, queues, toConfirm, unpaid, kitchenNow, kitchenNext, livePromos, nextPromo, plans, emailProblems, launchItems] = await Promise.all([
    getOrderKpis(now, tz),
    orderQueueCounts(),
    db.order.findMany({ where: { status: { in: ["NEW", "CONTACTED"] } }, orderBy: { createdAt: "asc" }, take: 6, select: listSelect }),
    db.order.findMany({
      where: { status: { in: [...going] }, paymentStatus: { not: "PAID" } },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: listSelect,
    }),
    getKitchenWeek(thisWeek),
    getKitchenWeek(nextWeek),
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
      select: { id: true, name: true, priceCents: true, isRecommended: true },
    }),
    db.emailOutbox.findMany({
      where: { OR: [{ status: { in: ["FAILED", "DEAD"] } }, { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 15 * 60_000) } }] },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, order: { select: { id: true, reference: true } } },
    }),
    launchChecklistItems(settings),
  ]);

  const money = (cents: number | null, cur: string) => (cents === null ? "—" : formatMoney(cents, cur));
  const failedOrders = [...new Map(emailProblems.filter((e) => e.order).map((e) => [e.order!.id, e.order!])).values()];

  return (
    <>
      {launchItems.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center">
          <Rocket className="size-5 shrink-0" aria-hidden="true" />
          <p className="flex-1 text-sm">
            <strong>Before you launch:</strong> {launchItems.join(", ")}.
          </p>
          <Button asChild variant="outline" className="border-amber-400 bg-white">
            <Link href="/admin/launch">Open launch checklist</Link>
          </Button>
        </div>
      )}

      {failedOrders.length > 0 && (
        <div role="alert" className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-red-950">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MailWarning className="size-4" /> Some emails haven&apos;t been delivered
          </p>
          <p className="mt-1 text-sm">Your orders are safe here. Emails are retried automatically; open an order to retry now.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {failedOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="rounded-full bg-white px-2.5 py-1 font-mono text-xs font-semibold ring-1 ring-red-200 hover:ring-red-400">
                  {o.reference}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-label="Orders at a glance" className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="To confirm" value={queues.to_confirm} href="/admin/orders?queue=to_confirm" tone="urgent" hint="Get in touch and confirm" />
        <Kpi label="Not paid yet" value={queues.unpaid} href="/admin/orders?queue=unpaid" hint="Confirmed, payment not recorded" />
        <Kpi label="Offer checks" value={kpis.needsReview} href="/admin/orders?eligibility=needs_review" hint="First-order offers to verify" />
        <Kpi label="Orders this month" value={kpis.thisMonth} href="/admin/growth?period=month" hint={`${kpis.total} in total`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <AdminCard title="Orders to handle" actions={<CardLink href="/admin/orders">All orders</CardLink>}>
            {toConfirm.length === 0 && unpaid.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-5 text-emerald-600" /> All caught up — nothing to confirm and every confirmed order is paid.
              </p>
            ) : (
              <div className="space-y-6">
                {toConfirm.length > 0 && (
                  <OrderList
                    title="To confirm"
                    more={queues.to_confirm - toConfirm.length}
                    moreHref="/admin/orders?queue=to_confirm"
                    rows={toConfirm.map((o) => ({
                      ...o,
                      amount: money(o.confirmedTotalCents ?? o.totalCents, o.currency),
                      when: `Sent ${formatDateTime(o.createdAt, tz, { dateStyle: "medium", timeStyle: "short" })}`,
                      action: <ConfirmOrderButton orderId={o.id} />,
                    }))}
                  />
                )}
                {unpaid.length > 0 && (
                  <OrderList
                    title="Not paid yet"
                    more={queues.unpaid - unpaid.length}
                    moreHref="/admin/orders?queue=unpaid"
                    rows={unpaid.map((o) => ({
                      ...o,
                      amount: money(o.confirmedTotalCents ?? o.totalCents, o.currency),
                      when: `Ordered ${formatDateTime(o.createdAt, tz, { dateStyle: "medium" })}`,
                      action: <MarkPaidMenu orderId={o.id} size="sm" />,
                    }))}
                  />
                )}
              </div>
            )}
          </AdminCard>

          <KitchenCard weeks={[kitchenNow, kitchenNext]} labels={["This week", "Next week"]} />
        </div>

        <div className="space-y-6">
          {cutoff && (
            <AdminCard title="Ordering deadline" actions={<CardLink href="/admin/delivery">Change</CardLink>}>
              <div className="flex gap-3 text-sm">
                <CalendarClock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    Orders close {formatShortDay(cutoff.cutoffDay)}, {formatTime12(f.weeklyCutoffTime)}
                  </p>
                  <p className="text-muted-foreground">
                    That&apos;s in {timeLeft(cutoff.cutoff.getTime() - now.getTime())}. Orders sent before then start the week of{" "}
                    {formatShortDay(cutoff.weekStart)}.
                  </p>
                </div>
              </div>
            </AdminCard>
          )}

          <AdminCard title="Offers running" actions={<CardLink href="/admin/promotions">Manage</CardLink>}>
            {livePromos.length === 0 ? (
              <div className="text-sm">
                <p className="text-muted-foreground">No offer is running right now.</p>
                {nextPromo && (
                  <p className="mt-2">
                    Next: <strong>{nextPromo.name}</strong> starts {formatDateTime(nextPromo.startsAt, tz)}.
                  </p>
                )}
              </div>
            ) : (
              <ul className="space-y-5">
                {livePromos.map((p) => {
                  const longRunning = p.endsAt.getTime() - now.getTime() > 60 * DAY_MS;
                  return (
                    <li key={p.id} className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone="good">Live</StatusBadge>
                        <Link href={`/admin/promotions/${p.id}`} className="font-semibold hover:underline">
                          {p.name}
                        </Link>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {discountLabel(p, currency)}
                        {p.audience === "NEW_CUSTOMERS" ? " · new customers" : ""}
                        {p.personalWindowMinutes ? ` · each visitor gets ${windowLabel(p.personalWindowMinutes)} to order` : ""}
                      </p>
                      {longRunning ? (
                        <p className="text-sm text-muted-foreground">Runs until {formatDateTime(p.endsAt, tz, { dateStyle: "medium" })}</p>
                      ) : (
                        <Countdown endsAt={p.endsAt.toISOString()} serverNow={now.toISOString()} size="sm" label="Ends in" refreshOnEnd={false} />
                      )}
                      <p className="text-sm">
                        <Link href={`/admin/orders?promotion=${p.id}`} className="underline underline-offset-4">
                          {p._count.orders} order{p._count.orders === 1 ? "" : "s"}
                        </Link>{" "}
                        with this offer
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Packages & prices" actions={<CardLink href="/admin/plans">Edit</CardLink>}>
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No packages on sale — customers can&apos;t order until you add one.</p>
            ) : (
              <ul className="divide-y text-sm">
                {plans.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span>
                      {p.name}
                      {p.isRecommended && <StatusBadge className="ml-2">Recommended</StatusBadge>}
                    </span>
                    {p.priceCents === null ? (
                      <span className="text-amber-800">No price set</span>
                    ) : (
                      <span className="font-semibold tabular">{formatMoney(p.priceCents, currency)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Shortcuts">
            <Shortcuts
              items={[
                { href: "/admin/meals", label: "Change the menu", icon: Utensils },
                { href: "/admin/plans", label: "Change package prices", icon: Tags },
                { href: "/admin/promotions", label: "Start an offer", icon: Timer },
                { href: "/admin/gallery", label: "Add Instagram photos", icon: ImagePlus },
              ]}
            />
          </AdminCard>
        </div>
      </div>
    </>
  );
}

function timeLeft(ms: number) {
  const hours = Math.max(0, Math.floor(ms / 3_600_000));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ${hours % 24} hour${hours % 24 === 1 ? "" : "s"}`;
  const minutes = Math.max(1, Math.floor(ms / 60_000) % 60);
  return hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"} ${minutes} min` : `${minutes} min`;
}

function windowLabel(minutes: number) {
  return minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} minutes`;
}

interface OrderRow {
  id: string;
  reference: string;
  customerName: string;
  planName: string;
  status: string;
  paymentStatus: string;
  paymentProvider: string | null;
  amount: string;
  when: string;
  action: React.ReactNode;
}

function OrderList({ title, rows, more, moreHref }: { title: string; rows: OrderRow[]; more: number; moreHref: string }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <ul className="divide-y">
        {rows.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <Link href={`/admin/orders/${o.id}`} className="min-w-0 flex-1 basis-56 hover:underline-offset-4 [&:hover_.name]:underline">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-mono text-xs font-semibold">{o.reference}</span>
                <span className="name font-medium">{o.customerName}</span>
                <OrderStatusBadge status={o.status} />
                {o.status !== "NEW" && o.status !== "CONTACTED" && (
                  <PaymentBadge status={o.paymentStatus} method={paymentMethodLabel(o.paymentProvider)} />
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {o.planName} · {o.amount} · {o.when}
              </span>
            </Link>
            <div className="shrink-0">{o.action}</div>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Link href={moreHref} className="mt-2 inline-flex items-center gap-1 text-sm font-medium hover:underline">
          {more} more <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function KitchenCard({ weeks, labels }: { weeks: KitchenWeek[]; labels: string[] }) {
  const names = [...new Set(weeks.flatMap((w) => w.dishes.map((d) => d.name)))];
  const anything = weeks.some((w) => w.confirmedOrders + w.pendingOrders > 0);
  const undated = weeks[0]?.undated ?? 0;
  return (
    <AdminCard
      title="Kitchen: meals to prepare"
      description="Meals per week from orders with a start date. Confirmed orders count; unconfirmed ones are shown in brackets."
    >
      {!anything ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChefHat className="size-5" /> No orders with a start date in this or next week yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Dish</th>
                {weeks.map((w, i) => (
                  <th key={w.weekStart} className="py-2 pl-3 text-right font-medium">
                    {labels[i]}
                    <span className="block font-normal">from {formatShortDay(w.weekStart)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {names.map((name) => (
                <tr key={name}>
                  <td className="py-2 pr-3">{name}</td>
                  {weeks.map((w) => {
                    const d = w.dishes.find((x) => x.name === name);
                    return (
                      <td key={w.weekStart} className="py-2 pl-3 text-right tabular">
                        <span className="font-semibold">{d?.confirmed ?? 0}</span>
                        {d && d.pending > 0 && <span className="ml-1 text-muted-foreground">(+{d.pending})</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="py-2 pr-3">Total meals</td>
                {weeks.map((w) => (
                  <td key={w.weekStart} className="py-2 pl-3 text-right tabular">
                    {w.confirmedMeals}
                    {w.pendingMeals > 0 && <span className="ml-1 font-normal text-muted-foreground">(+{w.pendingMeals})</span>}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {w.confirmedOrders} confirmed order{w.confirmedOrders === 1 ? "" : "s"}
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {undated > 0 && (
        <p className="mt-3 text-xs text-amber-800">
          {undated} confirmed order{undated === 1 ? " has" : "s have"} no start date yet, so {undated === 1 ? "it isn't" : "they aren't"} counted — set the
          date on the order.
        </p>
      )}
    </AdminCard>
  );
}

// ── Editors: website content ───────────────────────────────────────────────

async function EditorDashboard() {
  const recentMedia = await db.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, url: true, altText: true, filename: true, isPlaceholder: true },
  });
  return (
    <div className="space-y-6">
      <Shortcuts
        large
        items={[
          { href: "/admin/meals", label: "Menu & dishes", hint: "Photos, macros, what's on this week", icon: Utensils },
          { href: "/admin/gallery", label: "Instagram gallery", hint: "Add photos to the website gallery", icon: ImagePlus },
          { href: "/admin/content", label: "Homepage & pages", hint: "Headlines, text and buttons", icon: FileText },
          { href: "/admin/blog", label: "Blog", hint: "Write or edit an article", icon: Newspaper },
          { href: "/admin/faqs", label: "FAQs", hint: "Answer common questions", icon: HelpCircle },
          { href: "/admin/media", label: "Media library", hint: "All uploaded images", icon: Images },
        ]}
      />
      <AdminCard title="Recently uploaded images" actions={<CardLink href="/admin/media">Media library</CardLink>}>
        {recentMedia.length === 0 ? (
          <p className="text-sm text-muted-foreground">No images uploaded yet. Add real photos of your meals in the Media library.</p>
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
  );
}

function Shortcuts({
  items,
  large = false,
}: {
  items: { href: string; label: string; hint?: string; icon: React.ComponentType<{ className?: string }> }[];
  large?: boolean;
}) {
  return (
    <ul className={cn("grid gap-2 text-sm", large && "gap-3 sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map((a) => (
        <li key={a.href}>
          <Link
            href={a.href}
            className={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-ink", large && "rounded-xl p-5")}
          >
            <a.icon className={cn("size-4 shrink-0 text-muted-foreground", large && "size-6 text-foreground")} />
            <span className="min-w-0">
              <span className={cn("block", large && "font-semibold")}>{a.label}</span>
              {a.hint && <span className="block text-xs text-muted-foreground">{a.hint}</span>}
            </span>
            <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Sample content still on the site (shown to admins until they've replaced it). */
async function launchChecklistItems(settings: Awaited<ReturnType<typeof getSettings>>): Promise<string[]> {
  const [demoMeals, demoPlans, demoGallery, demoFaqs, demoPromos, placeholderImages, plansWithoutPrice] = await Promise.all([
    db.meal.count({ where: { isDemo: true, archivedAt: null } }),
    db.plan.count({ where: { isDemo: true, archivedAt: null } }),
    db.galleryItem.count({ where: { isDemo: true } }),
    db.fAQ.count({ where: { isDemo: true } }),
    db.promotion.count({ where: { isDemo: true } }),
    db.mediaAsset.count({ where: { isPlaceholder: true } }),
    db.plan.count({ where: { isActive: true, archivedAt: null, priceCents: null } }),
  ]);
  const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
  return [
    demoPlans && n(demoPlans, "sample plan"),
    plansWithoutPrice && `${n(plansWithoutPrice, "plan")} without a price`,
    demoMeals && n(demoMeals, "sample meal"),
    demoGallery && n(demoGallery, "placeholder gallery tile"),
    demoFaqs && `${n(demoFaqs, "sample FAQ")} to review`,
    demoPromos && n(demoPromos, "example promotion"),
    placeholderImages && !demoGallery && n(placeholderImages, "placeholder image"),
    settings.site.showDemoNotice && "the “preview site” banner is still switched on",
  ].filter(Boolean) as string[];
}
