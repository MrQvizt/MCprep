import Link from "next/link";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { ConsentBanner } from "@/components/analytics/consent-banner";
import { OfferBar, type OfferBarPromo } from "@/components/public/offer-bar";
import { OrderCutoffBar } from "@/components/public/order-cutoff-notice";
import { ThirdPartyScripts } from "@/components/analytics/third-party-scripts";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader, type NavItem } from "@/components/public/site-header";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { getContent } from "@/lib/content";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { getOfferWindowStart } from "@/lib/offer-window-server";
import { formatTime12, nextCutoff } from "@/lib/order-cutoff";
import { discountShortLabel } from "@/lib/promotions/format";
import { getBrandAssets, requestNow } from "@/lib/public-data";
import { getLivePublicPromotions } from "@/lib/promotions";
import { getSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/whatsapp";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const now = await requestNow();
  const [settings, brand, footer, livePromos, windowStart, customer] = await Promise.all([
    getSettings(),
    getBrandAssets(),
    getContent("page.footer"),
    getLivePublicPromotions(now).catch(() => []),
    getOfferWindowStart(now),
    getCurrentCustomer(),
  ]);

  // Offer with a personal deadline ("order within 2 hours"): shown until this visitor's window ends.
  const personal = livePromos.find((p) => p.personalWindowMinutes);
  const windowOpen =
    personal &&
    (!windowStart || windowStart.getTime() + personal.personalWindowMinutes! * 60_000 > now.getTime());
  const offerBar: OfferBarPromo | null =
    personal && windowOpen
      ? {
          slug: personal.slug,
          headline: personal.headline,
          shortLabel:
            personal.discountType === "FIRST_WEEK_MEAL_PRICE"
              ? `First week ${discountShortLabel(personal.discountType, personal.discountValue, settings.business.currency)}`
              : personal.headline,
          windowMinutes: personal.personalWindowMinutes!,
          endsAt: personal.endsAt,
          newCustomersOnly: personal.audience === "NEW_CUSTOMERS",
        }
      : null;
  const f = settings.fulfillment;
  const cutoff = f.weeklyCutoffEnabled
    ? nextCutoff(now, { weekday: f.weeklyCutoffDay, time: f.weeklyCutoffTime }, settings.business.timeZone)
    : null;

  const c = settings.contact;
  const wa = c.whatsappEnabled ? whatsappLink(c.whatsappNumber, c.whatsappDefaultMessage) : null;
  const waPlain = whatsappLink(c.whatsappNumber, c.whatsappDefaultMessage);

  const nav: NavItem[] = [
    { href: "/menu", label: "Menu" },
    { href: "/plans", label: "Packages" },
    { href: "/how-it-works", label: "How it works" },
    ...(livePromos.length > 0 ? [{ href: "/offers", label: "Offers" }] : []),
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
  ];

  const t = settings.tracking;
  const trackingConfig = {
    firstParty: t.firstPartyAnalyticsEnabled,
    ga4Id: t.ga4MeasurementId,
    gtmId: t.gtmContainerId,
    metaPixelId: t.metaPixelId,
    googleAdsId: t.googleAdsId,
    consentBannerEnabled: t.consentBannerEnabled,
  };

  return (
    <AnalyticsProvider config={trackingConfig}>
      <div className="dark flex min-h-dvh flex-col bg-ink text-white">
        <a
          href="#main"
          className="sr-only z-[100] bg-white px-4 py-3 text-sm font-semibold text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
        {settings.site.showDemoNotice && (
          <div className="bg-white px-4 py-2 text-center text-[0.72rem] font-medium text-ink" role="note">
            {settings.site.demoNoticeText}
          </div>
        )}
        {settings.site.announcementText && (
          <div className="border-b border-white/10 bg-charcoal px-4 py-2.5 text-center text-xs tracking-wide">
            {settings.site.announcementHref ? (
              <Link href={settings.site.announcementHref} className="underline-offset-4 hover:underline">
                {settings.site.announcementText}
              </Link>
            ) : (
              settings.site.announcementText
            )}
          </div>
        )}
        {offerBar && <OfferBar promo={offerBar} startedAt={windowStart?.toISOString() ?? null} serverNow={now.toISOString()} />}
        {cutoff && (
          <OrderCutoffBar
            cutoff={cutoff.cutoff.toISOString()}
            cutoffDay={cutoff.cutoffDay}
            weekStart={cutoff.weekStart}
            timeLabel={formatTime12(f.weeklyCutoffTime)}
            serverNow={now.toISOString()}
          />
        )}
        <SiteHeader
          brand={{ logoText: brand.logoText, logo: brand.logo }}
          nav={nav}
          ctaLabel="Build your package"
          ctaHref="/order"
          whatsappHref={waPlain}
          instagramUrl={c.instagramUrl || null}
          account={customer ? { firstName: customer.firstName } : null}
        />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter
          brand={{ logoText: brand.logoText, logo: brand.logo }}
          settings={settings}
          tagline={footer.tagline}
          smallPrint={footer.smallPrint}
          whatsappHref={waPlain}
        />
        {wa && <WhatsAppButton href={wa} />}
        <ConsentBanner />
        <ThirdPartyScripts />
      </div>
    </AnalyticsProvider>
  );
}
