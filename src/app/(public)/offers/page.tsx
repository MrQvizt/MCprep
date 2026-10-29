import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ClickTracking } from "@/components/public/click-tracking";
import { CtaBand } from "@/components/public/cta-band";
import { PageHero } from "@/components/public/page-hero";
import { PromoStrip } from "@/components/public/promo-strip";
import { Section } from "@/components/public/section";
import { InstagramIcon } from "@/components/shared/icons";
import { MediaImage } from "@/components/shared/media-image";
import { getContent } from "@/lib/content";
import { getLivePublicPromotions } from "@/lib/promotions";
import { getLiveLandingPages } from "@/lib/public/data";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { requestNow } from "@/lib/public-data";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";
import { isInstagramUrl } from "@/lib/urls";

export async function generateMetadata() {
  return staticPageMetadata("offers");
}

export default async function OffersPage() {
  const now = await requestNow();
  const [settings, content, crumb, whatsappHref] = await Promise.all([
    getSettings(),
    getContent("page.offers"),
    crumbFor("offers"),
    getWhatsappHref(),
  ]);
  const promos = await getLivePublicPromotions(now, settings.business.currency).catch(() => []);
  const pages = await getLiveLandingPages(promos.map((p) => p.id));
  const pageForPromo = new Map(pages.filter((p) => p.promotionId).map((p) => [p.promotionId!, p]));
  const otherPages = pages.filter((p) => !p.promotionId);
  const insta = isInstagramUrl(settings.contact.instagramUrl) ? settings.contact.instagramUrl : null;

  return (
    <>
      <ClickTracking />
      <PageHero crumbs={[crumb]} eyebrow={content.eyebrow} title={content.heading} intro={content.intro} />
      <Section tone="ink" aria-label="Offers">
        {promos.length === 0 && otherPages.length === 0 ? (
          <div className="max-w-2xl border border-white/15 p-8">
            <p className="text-lg text-white/85">{content.emptyMessage}</p>
            {insta && (
              <a href={insta} target="_blank" rel="noopener noreferrer" data-track="click_instagram" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] underline underline-offset-8">
                <InstagramIcon className="size-4" /> Follow on Instagram
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {promos.map((promo) => {
              const page = pageForPromo.get(promo.id);
              return <PromoStrip key={promo.id} promo={promo} serverNow={now.toISOString()} href={page ? `/offers/${page.slug}` : "/plans"} />;
            })}
            {otherPages.length > 0 && (
              <ul className="grid gap-4 pt-6 md:grid-cols-2">
                {otherPages.map((p) => (
                  <li key={p.id}>
                    <Link href={`/offers/${p.slug}`} className="group relative block overflow-hidden border border-white/15">
                      <MediaImage media={p.heroImage} alt="" className="aspect-[16/9]" sizes="(min-width:768px) 50vw, 100vw" imgClassName="opacity-70 transition-transform duration-700 group-hover:scale-105" />
                      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-ink to-transparent p-6">
                        <span>
                          <span className="block font-display text-2xl font-extrabold uppercase">{p.headline}</span>
                          {p.subheadline && <span className="mt-1 block text-sm text-fog">{p.subheadline}</span>}
                        </span>
                        <ArrowUpRight className="size-5 shrink-0" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>
      <CtaBand whatsappHref={whatsappHref} />
    </>
  );
}
