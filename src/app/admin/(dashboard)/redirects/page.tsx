import Link from "next/link";
import { CornerDownRight, ExternalLink, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { IssueList } from "@/components/admin/seo/issue-list";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { getSeoOverview } from "@/lib/seo/quality";
import { formatDateTime } from "@/lib/time";
import { deleteRedirect, toggleRedirect } from "./actions";
import { RedirectForm } from "./redirect-form";

export const metadata = { title: "Redirects" };

export default async function RedirectsPage() {
  await requireAdmin(AREA_ROLES.redirects);
  const [rules, overview] = await Promise.all([
    db.redirectRule.findMany({ orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }] }),
    getSeoOverview(),
  ]);
  const problems = overview.issues.filter((i) => i.code.startsWith("REDIRECT_"));

  return (
    <>
      <AdminPageHeader
        title="Redirects"
        description="Send visitors (and Google) from an old address to a new one, so links and rankings keep working when a page moves. When you change the address of a blog post, meal or offer page, a redirect is created for you automatically."
      />
      <div className="space-y-8">
        <AdminCard title="Add a redirect">
          <RedirectForm compact />
        </AdminCard>

        {problems.length > 0 && (
          <AdminCard title="Redirects that need attention">
            <IssueList issues={problems} />
          </AdminCard>
        )}

        {rules.length === 0 ? (
          <EmptyState icon={CornerDownRight} title="No redirects yet" description="You only need redirects when a page's address changes or an old link should go somewhere new." />
        ) : (
          <AdminCard title={`All redirects (${rules.length})`}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Old address</TableHead>
                    <TableHead>New address</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-64 truncate font-mono text-xs">{r.fromPath}</TableCell>
                      <TableCell className="max-w-64 truncate font-mono text-xs" title={r.toPath}>
                        {r.toPath}
                      </TableCell>
                      <TableCell className="text-xs">{r.statusCode === 301 ? "Permanent" : "Temporary"}</TableCell>
                      <TableCell>{r.isActive ? <StatusBadge tone="good">Active</StatusBadge> : <StatusBadge>Paused</StatusBadge>}</TableCell>
                      <TableCell className="text-right tabular">{r.hits}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.lastHitAt ? formatDateTime(r.lastHitAt) : "Never"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon-sm" aria-label={`Test ${r.fromPath}`} title="Test (opens the old address)">
                            <a href={r.fromPath} target="_blank" rel="noopener">
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                          <ActionButton action={toggleRedirect.bind(null, r.id)} label={r.isActive ? "Pause" : "Activate"}>
                            {r.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                          </ActionButton>
                          <Button asChild variant="ghost" size="icon-sm" aria-label="Edit">
                            <Link href={`/admin/redirects/${r.id}`}>
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                          <ConfirmAction
                            action={deleteRedirect.bind(null, r.id)}
                            title="Delete this redirect?"
                            description={`Visitors to ${r.fromPath} will see “page not found” unless a page exists there.`}
                            confirmLabel="Delete"
                            destructive
                            variant="ghost"
                            size="icon-sm"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Delete</span>
                          </ConfirmAction>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AdminCard>
        )}
      </div>
    </>
  );
}
