import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import type { IssueSeverity } from "@/lib/seo/quality";
import { cn } from "@/lib/utils";

export interface IssueLike {
  id: string;
  severity: IssueSeverity;
  title: string;
  message: string;
  href: string;
  category?: string;
}

const ICON = { error: AlertCircle, warning: AlertTriangle, info: Info } as const;
const TONE = {
  error: "text-red-700 bg-red-50",
  warning: "text-amber-800 bg-amber-50",
  info: "text-sky-800 bg-sky-50",
} as const;
export const SEVERITY_TEXT: Record<IssueSeverity, string> = { error: "Fix now", warning: "Should fix", info: "Good to know" };

export function SeverityPill({ severity }: { severity: IssueSeverity }) {
  const Icon = ICON[severity];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", TONE[severity])}>
      <Icon className="size-3.5" /> {SEVERITY_TEXT[severity]}
    </span>
  );
}

export function IssueSummary({ counts }: { counts: { error: number; warning: number; info: number } }) {
  const items: { key: IssueSeverity; label: string }[] = [
    { key: "error", label: "Fix now" },
    { key: "warning", label: "Should fix" },
    { key: "info", label: "Good to know" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((i) => {
        const Icon = ICON[i.key];
        return (
          <div key={i.key} className="rounded-xl border bg-card p-4">
            <div className={cn("inline-flex size-8 items-center justify-center rounded-full", TONE[i.key])}>
              <Icon className="size-4" />
            </div>
            <p className="mt-3 font-display text-3xl font-black tabular">{counts[i.key]}</p>
            <p className="text-sm text-muted-foreground">{i.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export function IssueList({ issues, emptyText = "No issues found. Nice work.", limit }: { issues: IssueLike[]; emptyText?: string; limit?: number }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="size-5" /> {emptyText}
      </div>
    );
  }
  const shown = limit ? issues.slice(0, limit) : issues;
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {shown.map((issue) => {
        const Icon = ICON[issue.severity];
        const external = issue.href.startsWith("/sitemap") || issue.href.startsWith("/robots");
        return (
          <li key={issue.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
            <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full", TONE[issue.severity])}>
              <Icon className="size-4" />
              <span className="sr-only">{SEVERITY_TEXT[issue.severity]}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{issue.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{issue.message}</p>
            </div>
            <Link
              href={issue.href}
              {...(external ? { target: "_blank" } : {})}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Fix <ArrowRight className="size-3.5" />
            </Link>
          </li>
        );
      })}
      {limit && issues.length > limit && (
        <li className="p-4 text-sm text-muted-foreground">+ {issues.length - limit} more</li>
      )}
    </ul>
  );
}
