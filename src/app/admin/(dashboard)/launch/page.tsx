import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { ChecklistToggle } from "@/components/admin/seo/checklist-toggle";
import { StatusBadge } from "@/components/admin/status-badge";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { emailTransport, env } from "@/lib/env";
import { getChecklist, getLaunchReadiness, monthKey, monthLabel, MONTHLY_ITEMS, type LaunchItem } from "@/lib/launch";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { setChecklistItemAction } from "./actions";

export const metadata = { title: "Launch checklist" };

function StatusIcon({ status }: { status: LaunchItem["status"] }) {
  if (status === "done") return <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-label="Done" />;
  if (status === "warning") return <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-label="Recommended" />;
  return <Circle className="size-5 shrink-0 text-muted-foreground" aria-label="To do" />;
}

function previousMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export default async function LaunchPage({ searchParams }: PageProps<"/admin/launch">) {
  await requireAdmin(AREA_ROLES.launch);
  const sp = await searchParams;
  const current = monthKey();
  const month = typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : current;
  const [readiness, monthly] = await Promise.all([getLaunchReadiness(), getChecklist(`monthly.${month}`, MONTHLY_ITEMS)]);
  const auto = readiness.items.filter((i) => i.auto);
  const manual = readiness.items.filter((i) => !i.auto);
  const monthlyDone = monthly.filter((m) => m.done).length;
  const e = env();
  const transport = emailTransport();

  const devChecks = [
    { label: "Database connected", ok: true },
    { label: "Session secret (AUTH_SECRET)", ok: Boolean(e.AUTH_SECRET) },
    { label: "Website address (NEXT_PUBLIC_SITE_URL)", ok: e.NEXT_PUBLIC_SITE_URL.startsWith("https://"), value: e.NEXT_PUBLIC_SITE_URL },
    { label: "Email provider (RESEND_API_KEY + EMAIL_FROM)", ok: transport === "resend" && Boolean(e.EMAIL_FROM), value: transport },
    { label: "Image storage (STORAGE_DRIVER)", ok: e.STORAGE_DRIVER === "s3", value: e.STORAGE_DRIVER },
    { label: "Scheduled jobs secret (CRON_SECRET)", ok: Boolean(e.CRON_SECRET) },
  ];

  return (
    <>
      <AdminPageHeader title="Launch checklist" description="Everything to check before your website goes live — and a simple monthly routine to keep it working for you." />
      <div className="space-y-8">
        <section className="rounded-xl border bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Launch readiness</p>
              <p className="font-display text-4xl font-black tabular">{readiness.percent}%</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {readiness.done} of {readiness.total} items done
            </p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={readiness.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Launch readiness">
            <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${readiness.percent}%` }} />
          </div>
        </section>

        <AdminCard title="Checked automatically" description="These update by themselves as you set things up.">
          <ul className="divide-y">
            {auto.map((item) => (
              <li key={item.key} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    {item.status === "warning" && <StatusBadge tone="warn">Recommended</StatusBadge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  {item.detail && <p className={cn("mt-1 text-sm", item.status === "done" ? "text-muted-foreground" : "text-amber-800")}>{item.detail}</p>}
                </div>
                {item.status !== "done" && item.hrefLabel && (
                  <Link href={item.href} className="inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                    {item.hrefLabel} <ArrowRight className="size-3.5" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard title="Tick when done" description="Things only you can confirm.">
          <ul className="space-y-4">
            {manual.map((item) => (
              <li key={item.key} className="flex gap-3">
                <ChecklistToggle done={item.status === "done"} label={item.title} action={setChecklistItemAction.bind(null, `launch.${item.key}`)} />
                <div className="min-w-0 flex-1">
                  <p className={item.status === "done" ? "font-medium text-muted-foreground line-through" : "font-medium"}>{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  {item.doneAt && <p className="mt-0.5 text-xs text-muted-foreground">Done {formatDate(item.doneAt)}</p>}
                </div>
                {item.hrefLabel && item.href.startsWith("/") && (
                  <Link href={item.href} className="shrink-0 text-sm underline-offset-4 hover:underline">
                    {item.hrefLabel}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard
          title={`Monthly routine — ${monthLabel(month)}`}
          description={`${monthlyDone} of ${monthly.length} done. A short list to keep the website, Google listing and offers fresh.`}
          actions={
            <div className="flex gap-2 text-sm">
              <Link href={`/admin/launch?month=${previousMonth(month)}`} className="underline-offset-4 hover:underline">
                ← {monthLabel(previousMonth(month))}
              </Link>
              {month !== current && (
                <Link href="/admin/launch" className="underline-offset-4 hover:underline">
                  This month →
                </Link>
              )}
            </div>
          }
        >
          <ul className="space-y-4">
            {monthly.map((item) => (
              <li key={item.fullKey} className="flex gap-3">
                <ChecklistToggle done={item.done} label={item.title} action={setChecklistItemAction.bind(null, item.fullKey)} />
                <div className="min-w-0 flex-1">
                  <p className={item.done ? "font-medium text-muted-foreground line-through" : "font-medium"}>{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {item.href && (
                  <Link href={item.href} className="shrink-0 text-sm underline-offset-4 hover:underline">
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </AdminCard>

        <section id="developer-setup" className="scroll-mt-6">
          <AdminCard
            title="Developer setup"
            description="Technical settings made in your hosting provider (for example Vercel → Project → Settings → Environment Variables). Secret values are never shown here. See README and docs/DEPLOYMENT.md."
          >
            <ul className="divide-y text-sm">
              {devChecks.map((d) => (
                <li key={d.label} className="flex items-center gap-3 py-2.5">
                  {d.ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4 text-muted-foreground" />}
                  <span className="flex-1">{d.label}</span>
                  {d.value && <code className="text-xs text-muted-foreground">{d.value}</code>}
                </li>
              ))}
            </ul>
          </AdminCard>
        </section>
      </div>
    </>
  );
}
