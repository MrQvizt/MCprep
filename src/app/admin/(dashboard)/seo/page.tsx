import Link from "next/link";
import { CornerDownRight, ExternalLink, FileSearch, MapPin, Settings } from "lucide-react";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { IssueList, IssueSummary } from "@/components/admin/seo/issue-list";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { getSeoOverview, type SeoPageRow } from "@/lib/seo/quality";
import { countBySeverity } from "@/lib/site-health";
import { cn } from "@/lib/utils";

export const metadata = { title: "SEO & Google visibility" };

const GROUPS: { key: string; title: string; description: string; match: (p: SeoPageRow) => boolean }[] = [
  { key: "core", title: "Main pages", description: "Homepage, menu, plans and other core pages.", match: (p) => p.kind === "page" && (p.group === "core" || p.group === "conversion" || p.group === "content") },
  { key: "service", title: "Malta search pages", description: "Pages written for searches like “meal prep Malta”.", match: (p) => p.kind === "page" && p.group === "service" },
  { key: "blog", title: "Blog articles", description: "Published, scheduled and draft articles.", match: (p) => p.kind === "blog" },
  { key: "meal", title: "Meals", description: "Each published meal has its own page.", match: (p) => p.kind === "meal" },
  { key: "offer", title: "Offer pages", description: "Campaign landing pages under /offers.", match: (p) => p.kind === "offer" },
  { key: "locality", title: "Locality pages", description: "Delivery pages for individual localities.", match: (p) => p.kind === "locality" },
  { key: "legal", title: "Legal pages", description: "Privacy, terms and cookies.", match: (p) => p.kind === "page" && p.group === "legal" },
];

function PagesTable({ rows }: { rows: SeoPageRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-56">Page</TableHead>
            <TableHead className="min-w-72">How it appears in Google</TableHead>
            <TableHead>Google</TableHead>
            <TableHead>Issues</TableHead>
            <TableHead className="text-right">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={`${p.kind}:${p.id}`} className="align-top">
              <TableCell className="whitespace-normal">
                <p className="font-medium">{p.label}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{p.path}</p>
                {p.status !== "Live" && (
                  <StatusBadge tone={p.live ? "good" : "neutral"} className="mt-1.5">
                    {p.status}
                  </StatusBadge>
                )}
              </TableCell>
              <TableCell className="max-w-md whitespace-normal">
                <p className="line-clamp-1 text-sm text-[#1a0dab]">{p.title}</p>
                <p className={cn("mt-0.5 line-clamp-2 text-xs", p.description ? "text-muted-foreground" : "font-medium text-amber-700")}>
                  {p.description || "No description"}
                </p>
              </TableCell>
              <TableCell>
                {p.live ? (
                  p.indexable ? <StatusBadge tone="good">Shown</StatusBadge> : <StatusBadge tone="warn">Hidden</StatusBadge>
                ) : (
                  <StatusBadge>Not live</StatusBadge>
                )}
              </TableCell>
              <TableCell>{p.issueCount > 0 ? <StatusBadge tone="warn">{p.issueCount}</StatusBadge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                  <Button asChild size="sm" variant="outline">
                    <Link href={p.seoHref}>SEO</Link>
                  </Button>
                  {p.live && (
                    <Button asChild size="icon-sm" variant="ghost" aria-label={`View ${p.label}`}>
                      <Link href={p.path} target="_blank">
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default async function SeoOverviewPage({ searchParams }: PageProps<"/admin/seo">) {
  await requireAdmin(AREA_ROLES.seo);
  const sp = await searchParams;
  const showAll = sp.issues === "all";
  const { pages, issues } = await getSeoOverview();
  const counts = countBySeverity(issues);

  return (
    <>
      <AdminPageHeader
        title="SEO & Google visibility"
        description="See how every page appears in Google, fix problems in plain language, and keep the site easy to find for searches in Malta."
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/sitemap.xml" target="_blank" rel="noopener">
                <FileSearch className="size-4" /> Sitemap
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/redirects">
                <CornerDownRight className="size-4" /> Redirects
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-8">
        <IssueSummary counts={counts} />

        <AdminCard
          title="SEO quality assistant"
          description="Checks run every time you open this page. Fix the red items first."
          actions={
            issues.length > 12 && !showAll ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/seo?issues=all">Show all {issues.length}</Link>
              </Button>
            ) : undefined
          }
        >
          <IssueList issues={issues} limit={showAll ? undefined : 12} emptyText="No SEO problems found. Keep adding useful content." />
        </AdminCard>

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/admin/settings" className="rounded-xl border bg-card p-5 transition hover:border-ink">
            <Settings className="size-5" />
            <p className="mt-3 font-semibold">Default title & description</p>
            <p className="mt-1 text-sm text-muted-foreground">Set the site-wide title suffix and default description in Business settings.</p>
          </Link>
          <Link href="/admin/listings" className="rounded-xl border bg-card p-5 transition hover:border-ink">
            <MapPin className="size-5" />
            <p className="mt-3 font-semibold">Google Business & Search Console</p>
            <p className="mt-1 text-sm text-muted-foreground">Set up your Google listing, verify Search Console and track directory listings.</p>
          </Link>
          <Link href="/admin/health" className="rounded-xl border bg-card p-5 transition hover:border-ink">
            <FileSearch className="size-5" />
            <p className="mt-3 font-semibold">Weekly site health check</p>
            <p className="mt-1 text-sm text-muted-foreground">Broken links, emails, promotions and content that needs attention.</p>
          </Link>
        </div>

        {GROUPS.map((g) => {
          const rows = pages.filter(g.match);
          if (rows.length === 0) return null;
          return (
            <AdminCard key={g.key} title={g.title} description={g.description}>
              <PagesTable rows={rows} />
            </AdminCard>
          );
        })}
      </div>
    </>
  );
}
