import Link from "next/link";
import { ExternalLink, Eye, EyeOff, Megaphone, Pencil, Plus } from "lucide-react";
import { ActionButton } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/admin/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { LANDING_TYPE_LABELS } from "@/lib/admin/landing-pages";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { toggleLanding } from "./actions";

export const metadata = { title: "Offer pages" };

export default async function LandingPagesPage() {
  await requireAdmin(AREA_ROLES.promotions);
  const pages = await db.seasonalCampaignLandingPage.findMany({
    orderBy: { updatedAt: "desc" },
    include: { promotion: { select: { name: true, endsAt: true, isEnabled: true } } },
  });
  const now = new Date().getTime();

  return (
    <>
      <AdminPageHeader
        title="Offer pages"
        description="Dedicated pages for campaigns and adverts, at /offers/your-page. Link one to a promotion to show its countdown."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/landing-pages/new">
              <Plus className="size-4" /> New offer page
            </Link>
          </Button>
        }
      />
      {pages.length === 0 ? (
        <EmptyState icon={Megaphone} title="No offer pages yet" description="Create one for a seasonal campaign, an Instagram ad or a local promotion." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {pages.map((p) => {
            const ended = p.promotion ? p.promotion.endsAt.getTime() <= now : false;
            return (
              <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/landing-pages/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">/offers/{p.slug}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusBadge tone={p.isPublished ? "good" : "neutral"}>{p.isPublished ? "Published" : "Draft"}</StatusBadge>
                    <StatusBadge>{LANDING_TYPE_LABELS[p.type]}</StatusBadge>
                    {p.noindex ? <StatusBadge>Hidden from Google</StatusBadge> : <StatusBadge tone="info">Visible to Google</StatusBadge>}
                    {p.promotion && <StatusBadge tone={ended ? "warn" : "neutral"}>{ended ? "Offer ended" : p.promotion.name}</StatusBadge>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {p.isPublished && (
                    <Button asChild variant="ghost" size="icon-sm" aria-label="View page">
                      <Link href={`/offers/${p.slug}`} target="_blank">
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                  )}
                  <ActionButton action={toggleLanding.bind(null, p.id)} label={p.isPublished ? "Unpublish" : "Publish"}>
                    {p.isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </ActionButton>
                  <Button asChild variant="ghost" size="icon-sm" aria-label="Edit">
                    <Link href={`/admin/landing-pages/${p.id}`}>
                      <Pencil className="size-4" />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
