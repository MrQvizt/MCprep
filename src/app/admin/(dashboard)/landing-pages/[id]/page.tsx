import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { LANDING_EXPIRED_LABELS, LANDING_TYPE_LABELS } from "@/lib/admin/landing-pages";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { MEDIA_SELECT } from "@/lib/media";
import { removeLanding } from "../actions";
import { LandingForm } from "../landing-form";
import { landingFormOptions } from "../shared";

export const metadata = { title: "Edit offer page" };

export default async function EditLandingPage({ params }: PageProps<"/admin/landing-pages/[id]">) {
  await requireAdmin(AREA_ROLES.promotions);
  const { id } = await params;
  const [page, options] = await Promise.all([
    db.seasonalCampaignLandingPage.findUnique({
      where: { id },
      include: { heroImage: { select: MEDIA_SELECT }, ogImage: { select: MEDIA_SELECT } },
    }),
    landingFormOptions(),
  ]);
  if (!page) notFound();

  return (
    <>
      <AdminPageHeader
        title={page.title}
        description={page.isPublished ? `Published at /offers/${page.slug}` : "Draft — not visible on the website."}
        back={{ href: "/admin/landing-pages", label: "All offer pages" }}
        actions={
          <>
            {page.isPublished && (
              <Button asChild variant="outline">
                <Link href={`/offers/${page.slug}`} target="_blank">
                  <ExternalLink className="size-4" /> View page
                </Link>
              </Button>
            )}
            <ConfirmAction
              action={removeLanding.bind(null, page.id)}
              title="Delete this offer page?"
              description="Links to it will show “page not found”. Consider unpublishing or adding a redirect instead."
              confirmLabel="Delete"
              destructive
              variant="outline"
            >
              <Trash2 className="size-4" /> Delete
            </ConfirmAction>
          </>
        }
      />
      <LandingForm
        {...options}
        types={LANDING_TYPE_LABELS}
        expiredOptions={LANDING_EXPIRED_LABELS}
        page={{ ...page, heroImage: page.heroImage, ogImage: page.ogImage }}
      />
    </>
  );
}
