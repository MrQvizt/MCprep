import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { CONTENT_GROUPS, CONTENT_VIEW_PATHS } from "@/lib/admin/content-fields";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { CONTENT_LABELS, getContent } from "@/lib/content";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Homepage & pages" };

export default async function ContentIndexPage() {
  await requireAdmin(AREA_ROLES.content);
  const rows = await db.pageContent.findMany({ select: { key: true, updatedAt: true } });
  const updated = new Map(rows.map((r) => [r.key, r.updatedAt]));
  const legalReviewed = await Promise.all(
    (["legal.privacy", "legal.terms", "legal.cookies"] as const).map(async (k) => [k, (await getContent(k)).reviewedByOwner] as const),
  );
  const reviewed = new Map<string, boolean>(legalReviewed);

  return (
    <>
      <AdminPageHeader
        title="Homepage & pages"
        description="Edit the headings, text, buttons and photos of your website. No coding needed — each section has simple fields."
      />
      <div className="space-y-8">
        {CONTENT_GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="text-base font-semibold">{group.title}</h2>
            <p className="mb-3 text-sm text-muted-foreground">{group.description}</p>
            <ul className="divide-y rounded-xl border bg-card">
              {group.keys.map((key) => {
                const at = updated.get(key);
                return (
                  <li key={key}>
                    <Link href={`/admin/content/${key}`} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{CONTENT_LABELS[key]}</p>
                        <p className="text-xs text-muted-foreground">
                          {CONTENT_VIEW_PATHS[key]} · {at ? `Edited ${formatDateTime(at)}` : "Default text"}
                        </p>
                      </div>
                      {reviewed.has(key) && !reviewed.get(key) && <StatusBadge tone="warn">Needs review</StatusBadge>}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
