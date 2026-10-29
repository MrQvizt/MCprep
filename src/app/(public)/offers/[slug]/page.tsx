import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TrackOnMount } from "@/components/analytics/tracked-link";
import { ClickTracking } from "@/components/public/click-tracking";
import { CtaLink } from "@/components/public/cta-link";
import { PlansGrid } from "@/components/public/home/fulfillment-plans";
import { RichText } from "@/components/public/rich-text";
import { Section } from "@/components/public/section";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { PromoCountdown } from "@/components/public/promo-countdown";
import { MediaImage } from "@/components/shared/media-image";
import { getCurrentAdmin } from "@/lib/authz";
import { formatPromoText } from "@/lib/promotions/format";
import { getLandingPage } from "@/lib/public/data";
import { orderHref, resolveLandingPage } from "@/lib/public/landing";
import { crumbFor } from "@/lib/public/page";
import { getPublicPlans, requestNow } from "@/lib/public-data";
import { buildMetadata, titleWithSuffix } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";

async function resolve(slug: string) {
  const data = await getLandingPage(slug);
  if (!data) return null;
  const admin = await getCurrentAdmin();
  const resolution = resolveLandingPage(data.page, data.promotion?.state ?? null, { isAdmin: Boolean(admin) });
  return { ...data, resolution };
}

export async function generateMetadata({ params }: PageProps<"/offers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await resolve(slug);
  if (!data || data.resolution.kind !== "render") return { title: "Offer not found", robots: { index: false } };
  const { page, resolution } = data;
  const og = page.ogImage ?? page.heroImage;
  return buildMetadata({
    title: page.seoTitle || (await titleWithSuffix(page.title)),
    description: page.seoDescription || page.subheadline || `${page.headline} — MC PREPS meal prep in Malta.`,
    path: `/offers/${page.slug}`,
    ogImage: og ? { url: og.url, width: og.width, height: og.height, alt: og.altText } : null,
    noindex: resolution.noindex,
  });
}

export default async function LandingPage({ params }: PageProps<"/offers/[slug]">) {
  const { slug } = await params;
  const data = await resolve(slug);
  if (!data) notFound();
  const { page, promotion, resolution } = data;
  if (resolution.kind === "not-found") notFound();
  if (resolution.kind === "redirect") redirect(resolution.to);

  const now = await requestNow();
  const [settings, offersCrumb, allPlans] = await Promise.all([getSettings(), crumbFor("offers"), getPublicPlans()]);
  const mode = resolution.mode;
  const text = (s: string | null | undefined) => (promotion ? formatPromoText(s, { discountLabel: promotion.discountLabel, endsAt: promotion.endsAt }) : (s ?? ""));

  const planFilter =
    page.planIds.length > 0 ? new Set(page.planIds) : promotion && !promotion.appliesToAllPlans ? new Set(promotion.planIds) : null;
  const plans = planFilter ? allPlans.filter((p) => planFilter.has(p.id)) : allPlans;
  const orderParams = { utm_campaign: page.utmCampaign, utm_source: page.utmCampaign ? "offer_page" : null };
  const primaryHref =
    plans.length === 1
      ? orderHref({ plan: plans[0].slug, promo: promotion?.slug, utmCampaign: page.utmCampaign, utmSource: page.utmCampaign ? "offer_page" : null })
      : "#plans";

  return (
    <>
      <ClickTracking />
      {promotion && mode === "live" && <TrackOnMount event="view_promotion" params={{ promotionSlug: promotion.slug }} />}
      {resolution.preview && (
        <div role="note" className="bg-[#ffd400] px-4 py-2 text-center text-xs font-semibold text-ink">
          Admin preview — visitors can&apos;t see this page{!page.isPublished ? " (not published)" : " (offer ended — hidden or redirected for visitors)"}.
        </div>
      )}
      <header className="relative isolate overflow-hidden border-b border-white/10 bg-ink text-white">
        <div className="absolute inset-0 -z-10">
          {page.heroImage ? (
            <MediaImage media={page.heroImage} alt="" priority sizes="100vw" className="absolute inset-0" imgClassName="opacity-45" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(70%_90%_at_85%_20%,#2a2a2a_0%,#080808_65%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/20" />
        </div>
        <div className="container-site pb-16 pt-8 sm:pb-20 sm:pt-10 lg:pb-28">
          <Breadcrumbs items={[offersCrumb, { name: page.title, path: `/offers/${page.slug}` }]} />
          <div className="mt-14 grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              {promotion?.badgeText && mode !== "expired" && (
                <p className="mb-5 inline-block bg-white px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-ink">{text(promotion.badgeText)}</p>
              )}
              <h1 className="display-xl text-balance">{mode === "expired" ? "This offer has ended" : text(page.headline)}</h1>
              {mode !== "expired" && page.subheadline && <p className="mt-5 display-sm text-white/80">{text(page.subheadline)}</p>}
              {mode === "live" && (
                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <CtaLink href={primaryHref} size="lg" data-track="select_promotion" data-track-promotion={promotion?.slug}>
                    {text(page.ctaText)}
                  </CtaLink>
                  {promotion?.audience === "NEW_CUSTOMERS" && (
                    <p className="max-w-xs text-xs text-fog">New customers only. Eligibility is confirmed by our team before your price is final.</p>
                  )}
                </div>
              )}
              {mode === "upcoming" && promotion && (
                <p className="mt-8 text-lg text-white/85">
                  This offer starts on <strong>{formatDateTime(promotion.startsAt, settings.business.timeZone, { dateStyle: "full", timeStyle: "short" })}</strong> (Malta time).
                </p>
              )}
              {(mode === "expired" || mode === "info") && (
                <p className="mt-6 max-w-xl text-lg text-fog">
                  {page.expiredMessage || promotion?.expiredMessage || "This offer is no longer available. See our current plans and offers below."}
                </p>
              )}
            </div>
            {mode === "live" && promotion?.showCountdown && (
              <div className="lg:justify-self-end">
                <PromoCountdown endsAt={promotion.endsAt} personalWindowMinutes={promotion.personalWindowMinutes} serverNow={now.toISOString()} size="lg" />
              </div>
            )}
          </div>
        </div>
      </header>

      {mode !== "expired" && page.body && (
        <Section tone="paper" aria-label="About this offer">
          <RichText html={page.body} className="max-w-3xl text-ink/85" />
        </Section>
      )}

      {mode === "live" && plans.length > 0 && (
        <Section tone="ink" id="plans" aria-labelledby="offer-plans" className="scroll-mt-20">
          <h2 id="offer-plans" className="display-lg text-center">
            Choose your plan
          </h2>
          <PlansGrid plans={plans} currency={settings.business.currency} orderParams={orderParams} className="mt-12" />
          {promotion?.terms && (
            <details className="mx-auto mt-12 max-w-3xl text-sm text-fog">
              <summary className="cursor-pointer underline-offset-4 hover:underline">Offer terms</summary>
              <p className="mt-3 whitespace-pre-line">{promotion.terms}</p>
            </details>
          )}
        </Section>
      )}

      {mode !== "live" && (
        <Section tone="charcoal" aria-label="Next steps" className="py-14 sm:py-16">
          <div className="flex flex-col gap-4 sm:flex-row">
            <CtaLink href="/plans">See our plans</CtaLink>
            <CtaLink href="/offers" variant="outline" className="border-white/40">
              Current offers
            </CtaLink>
          </div>
          <p className="mt-6 text-sm text-fog">
            Questions? <Link href="/contact" className="underline underline-offset-4">Contact us</Link>.
          </p>
        </Section>
      )}
    </>
  );
}
