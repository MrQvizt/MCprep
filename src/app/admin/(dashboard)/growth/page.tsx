import Link from "next/link";
import { Database, Info, MousePointerClick, PlugZap, TrendingUp } from "lucide-react";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { GROWTH_PERIODS, getGrowthReport, resolveGrowthPeriod, type CountRow } from "@/lib/admin/growth";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Growth & performance" };

type Source = "database" | "analytics" | "none";

const SOURCE_LABEL: Record<Source, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  database: { label: "Website database", icon: Database },
  analytics: { label: "First-party cookieless analytics", icon: MousePointerClick },
  none: { label: "Not connected", icon: PlugZap },
};

function SourceTag({ source }: { source: Source }) {
  const s = SOURCE_LABEL[source];
  return (
    <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
      <s.icon className="size-3" /> {s.label}
    </span>
  );
}

function MetricCard({ label, value, hint, source }: { label: string; value: number; hint?: string; source: Source }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <SourceTag source={source} />
      <p className="mt-3 font-display text-3xl font-extrabold tabular">{value.toLocaleString("en-GB")}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Bars({ rows, empty, unit = "" }: { rows: CountRow[]; empty: string; unit?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-semibold tabular">
              {r.count.toLocaleString("en-GB")}
              {unit}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(2, Math.round((r.count / max) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function GrowthPage({ searchParams }: PageProps<"/admin/growth">) {
  await requireAdmin(AREA_ROLES.growth);
  const sp = await searchParams;
  const settings = await getSettings();
  const tz = settings.business.timeZone;
  const period = resolveGrowthPeriod(typeof sp.period === "string" ? sp.period : undefined, new Date(), tz);
  const report = await getGrowthReport(period);
  const firstParty = settings.tracking.firstPartyAnalyticsEnabled;
  const noEvents = report.analytics.totalEvents === 0;
  const funnelMax = Math.max(...report.funnel.map((f) => f.count), 1);
  const lastDay = new Date(period.to.getTime() - 1);

  return (
    <>
      <AdminPageHeader
        title="Growth & performance"
        description="How your website is doing, in plain numbers. Each figure shows where it comes from — nothing here is estimated or made up."
      />

      <nav aria-label="Period" className="mb-6 flex flex-wrap gap-1.5">
        {Object.entries(GROWTH_PERIODS).map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/growth?period=${key}`}
            aria-current={period.key === key ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              period.key === key ? "border-ink bg-ink text-white" : "bg-background hover:bg-muted",
            )}
          >
            {label}
          </Link>
        ))}
        <span className="self-center pl-2 text-xs text-muted-foreground">
          {formatDate(period.from, tz)} – {formatDate(lastDay, tz)} (Malta time)
        </span>
      </nav>

      <AdminCard title="Summary" className="mb-6">
        {report.sentences.length > 0 ? (
          <ul className="space-y-2">
            {report.sentences.map((s) => (
              <li key={s} className="flex gap-2 text-base">
                <TrendingUp className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No activity recorded for {period.label.toLowerCase()} yet. Once visitors browse the site and send order requests, a plain-English
            summary appears here.
          </p>
        )}
      </AdminCard>

      <section aria-labelledby="orders-h" className="mb-8">
        <h2 id="orders-h" className="mb-3 text-lg font-semibold">
          Order requests
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Order requests received" value={report.orders.total} source="database" />
          <MetricCard label="Confirmed or completed" value={report.orders.confirmed} hint="Confirmed, in preparation or completed." source="database" />
          <MetricCard label="Still open" value={report.orders.open} hint="New or contacted, not yet confirmed." source="database" />
          <MetricCard label="Cancelled" value={report.orders.cancelled} source="database" />
        </div>
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <AdminCard title="Requests by package" actions={<SourceTag source="database" />}>
          <Bars rows={report.byPlan} empty="No order requests in this period." />
        </AdminCard>
        <AdminCard title="Requests by campaign" actions={<SourceTag source="database" />}>
          {report.byCampaign.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders used a promotion in this period.</p>
          ) : (
            <ul className="divide-y text-sm">
              {report.byCampaign.map((c) => (
                <li key={`${c.promotionId}-${c.name}`} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    {c.promotionId ? (
                      <Link href={`/admin/orders?promotion=${c.promotionId}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{c.name}</span>
                    )}
                    <span className="font-semibold tabular">
                      {c.orders} request{c.orders === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.redemptions.approved > 0 && <StatusBadge tone="good">{c.redemptions.approved} approved</StatusBadge>}
                    {c.redemptions.requested > 0 && <StatusBadge tone="warn">{c.redemptions.requested} awaiting decision</StatusBadge>}
                    {c.redemptions.rejected > 0 && <StatusBadge tone="bad">{c.redemptions.rejected} rejected</StatusBadge>}
                    {c.redemptions.cancelled > 0 && <StatusBadge>{c.redemptions.cancelled} cancelled</StatusBadge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
        <AdminCard title="Collection or delivery" actions={<SourceTag source="database" />}>
          <Bars
            rows={[
              { label: "Collection", count: report.fulfilment.collection },
              { label: "Delivery", count: report.fulfilment.delivery },
            ].filter((r) => r.count > 0)}
            empty="No order requests in this period."
          />
          {report.topLocalities.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <p className="mb-3 text-sm font-medium">Top delivery localities</p>
              <Bars rows={report.topLocalities} empty="" />
            </div>
          )}
        </AdminCard>
        <AdminCard
          title="Where order requests came from"
          description="Only recorded when the visitor allowed analytics, or arrived through a tagged campaign link."
          actions={<SourceTag source="database" />}
        >
          <Bars rows={report.orderSources} empty="No order requests in this period." />
        </AdminCard>
      </div>

      <section aria-labelledby="web-h" className="mb-8">
        <h2 id="web-h" className="mb-3 text-lg font-semibold">
          Website activity
        </h2>
        {!firstParty ? (
          <p className="mb-4 flex items-start gap-2 rounded-lg border bg-card p-4 text-sm">
            <Info className="mt-0.5 size-4 shrink-0" /> Website statistics are switched off in Business settings, so visits and clicks aren&apos;t
            counted.
          </p>
        ) : noEvents ? (
          <p className="mb-4 flex items-start gap-2 rounded-lg border bg-card p-4 text-sm">
            <Info className="mt-0.5 size-4 shrink-0" /> No website activity recorded for this period yet. Visits and clicks are counted without
            cookies and without identifying anyone.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Page views" value={report.analytics.pageViews} source="analytics" />
          <MetricCard label="WhatsApp clicks" value={report.analytics.whatsappClicks} source="analytics" />
          <MetricCard label="Instagram clicks" value={report.analytics.instagramClicks} source="analytics" />
          <MetricCard label="Phone & email clicks" value={report.analytics.phoneClicks + report.analytics.emailClicks} source="analytics" />
        </div>
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <AdminCard title="From visit to order request" description="How far visitors get. The last step counts real order requests saved in your database.">
          <ol className="space-y-3">
            {report.funnel.map((step) => (
              <li key={step.key} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    {step.label} <SourceTag source={step.source} />
                  </span>
                  <span className="font-semibold tabular">{step.count.toLocaleString("en-GB")}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className={cn("h-full rounded-full", step.source === "database" ? "bg-emerald-600" : "bg-ink")}
                    style={{ width: `${step.count === 0 ? 0 : Math.max(2, Math.round((step.count / funnelMax) * 100))}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </AdminCard>
        <AdminCard title="Most visited pages" actions={<SourceTag source="analytics" />}>
          <Bars rows={report.topPages.map((p) => ({ ...p, label: p.label === "/" ? "Homepage" : p.label }))} empty="No page views recorded yet." />
        </AdminCard>
        <AdminCard title="Traffic sources" description="Campaign tag or referring website for each page view." actions={<SourceTag source="analytics" />}>
          <Bars rows={report.trafficSources} empty="No page views recorded yet." />
        </AdminCard>
        <AdminCard title="Most viewed meals" actions={<SourceTag source="analytics" />}>
          <Bars rows={report.popularMeals} empty="No meal page views recorded yet." />
        </AdminCard>
      </div>

      <AdminCard
        title="Google Search performance"
        description="Clicks, impressions and search terms from Google Search Console."
        actions={<SourceTag source="none" />}
      >
        <p className="text-sm">
          Google Search Console isn&apos;t connected to this dashboard, so no search figures are shown here. You can still see them in Search
          Console itself.
        </p>
        <Link href="/admin/listings" className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
          Set up Google Search Console →
        </Link>
      </AdminCard>
    </>
  );
}
