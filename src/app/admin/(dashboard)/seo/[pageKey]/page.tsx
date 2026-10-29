import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { IssueList } from "@/components/admin/seo/issue-list";
import { Button } from "@/components/ui/button";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { absoluteUrl, siteUrl } from "@/lib/env";
import { getBrandAssets } from "@/lib/public-data";
import { STATIC_PAGES } from "@/lib/seo/pages";
import { getSeoOverview } from "@/lib/seo/quality";
import { getSettings } from "@/lib/settings";
import { SeoPageForm } from "./seo-page-form";

export const metadata = { title: "Edit page SEO" };

export default async function SeoPageEditor({ params }: PageProps<"/admin/seo/[pageKey]">) {
  await requireAdmin(AREA_ROLES.seo);
  const { pageKey } = await params;
  const page = STATIC_PAGES.find((p) => p.key === pageKey);
  if (!page) notFound();

  const [override, settings, brand, overview] = await Promise.all([
    db.sEOPageMetadata.findUnique({ where: { pageKey }, include: { ogImage: true } }),
    getSettings(),
    getBrandAssets(),
    getSeoOverview(),
  ]);
  const issues = overview.issues.filter((i) => i.path === page.path);
  const domain = (() => {
    try {
      return new URL(siteUrl()).hostname;
    } catch {
      return "mcpreps.mt";
    }
  })();

  return (
    <>
      <AdminPageHeader
        title={`SEO: ${page.label}`}
        description="Control how this page appears in Google and when it's shared."
        back={{ href: "/admin/seo", label: "SEO & Google visibility" }}
        actions={
          <Button asChild variant="outline">
            <Link href={page.path} target="_blank">
              <ExternalLink className="size-4" /> View page
            </Link>
          </Button>
        }
      />
      {issues.length > 0 && (
        <div className="mb-8">
          <IssueList issues={issues} />
        </div>
      )}
      <SeoPageForm
        pageKey={page.key}
        path={page.path}
        absoluteUrl={absoluteUrl(page.path)}
        siteName={settings.business.tradingName}
        domain={domain}
        important={page.indexable && (page.group === "core" || page.group === "service")}
        defaults={{ title: page.defaultTitle, description: page.defaultDescription, primaryTopic: page.primaryTopic, breadcrumb: page.breadcrumb }}
        values={{
          title: override?.title ?? "",
          description: override?.description ?? "",
          primaryTopic: override?.primaryTopic ?? "",
          ogTitle: override?.ogTitle ?? "",
          ogDescription: override?.ogDescription ?? "",
          ogImage: override?.ogImage
            ? { id: override.ogImage.id, url: override.ogImage.url, altText: override.ogImage.altText, width: override.ogImage.width, height: override.ogImage.height }
            : null,
          indexable: override ? !override.noindex : page.indexable,
          canonicalUrl: override?.canonicalUrl ?? "",
          breadcrumbLabel: override?.breadcrumbLabel ?? "",
        }}
        defaultShareImageUrl={brand.share?.url ?? "/og"}
        hasOverrides={Boolean(override)}
      />
    </>
  );
}
