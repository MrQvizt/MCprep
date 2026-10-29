import { Activity, RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { IssueList, IssueSummary } from "@/components/admin/seo/issue-list";
import { StatusBadge } from "@/components/admin/status-badge";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { countBySeverity, getHealthCheckHistory, getLatestHealthCheck } from "@/lib/site-health";
import { formatDateTime } from "@/lib/time";
import { runHealthCheckNow } from "./actions";

export const metadata = { title: "Site health" };

export default async function HealthPage() {
  await requireAdmin(AREA_ROLES.health);
  const [latest, history] = await Promise.all([getLatestHealthCheck(), getHealthCheckHistory(10)]);
  const ops = latest?.issues.filter((i) => i.category === "operations") ?? [];
  const seo = latest?.issues.filter((i) => i.category === "seo") ?? [];

  const runButton = (
    <ActionButton action={runHealthCheckNow} variant="default" size="lg" label="Run check now">
      <RefreshCw className="size-4" /> Run check now
    </ActionButton>
  );

  return (
    <>
      <AdminPageHeader
        title="Site health"
        description="A weekly check of broken links, missing SEO details, email delivery, promotions and content that needs attention. It runs automatically every week, and you can run it any time."
        actions={runButton}
      />
      {!latest ? (
        <EmptyState icon={Activity} title="No checks run yet" description="Run the first check to see how your website is doing." action={runButton} />
      ) : (
        <div className="space-y-8">
          <p className="text-sm text-muted-foreground">
            Last checked {formatDateTime(latest.createdAt)} ({latest.trigger === "scheduled" ? "automatic weekly check" : "run manually"}) in{" "}
            {(latest.durationMs / 1000).toFixed(1)}s.
          </p>
          <IssueSummary counts={countBySeverity(latest.issues)} />
          <AdminCard title="Operations" description="Order emails, promotions, scheduled articles, photos, delivery areas and legal pages.">
            <IssueList issues={ops} emptyText="Everything running smoothly." />
          </AdminCard>
          <AdminCard title="SEO & Google" description="Problems that can stop people finding you on Google.">
            <IssueList issues={seo} emptyText="No SEO problems found." />
          </AdminCard>
          <AdminCard title="Recent checks">
            <ul className="divide-y text-sm">
              {history.map((h) => {
                const issues = Array.isArray(h.issues) ? (h.issues as { severity: "error" | "warning" | "info" }[]) : [];
                const c = countBySeverity(issues);
                return (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-44">{formatDateTime(h.createdAt)}</span>
                    <StatusBadge>{h.trigger === "scheduled" ? "Automatic" : "Manual"}</StatusBadge>
                    <span className="text-muted-foreground">
                      {c.error} to fix now · {c.warning} should fix · {c.info} good to know
                    </span>
                  </li>
                );
              })}
            </ul>
          </AdminCard>
        </div>
      )}
    </>
  );
}
