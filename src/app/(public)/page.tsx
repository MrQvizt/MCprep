import { ClickTracking } from "@/components/public/click-tracking";
import { HomeFeaturedMeals, HomeHowItWorks } from "@/components/public/home/meals-steps";
import { HomeFulfillment, HomePlans } from "@/components/public/home/fulfillment-plans";
import { HomeHero } from "@/components/public/home/hero";
import { HomeBenefits, HomeIntro } from "@/components/public/home/intro-benefits";
import { HomeFaq, HomeFinalCta, HomeInstagram, HomeTestimonials } from "@/components/public/home/social-faq-cta";
import { PromoBanner } from "@/components/public/promo-banner";
import { StickyCta } from "@/components/public/sticky-cta";
import { TrackInView } from "@/components/public/track-in-view";
import { JsonLd } from "@/components/shared/json-ld";
import { getContents } from "@/lib/content";
import { getMedia } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import type { HeroOfferData } from "@/components/public/home/hero-offer";
import { getOfferWindowStart } from "@/lib/offer-window-server";
import { isPackage } from "@/lib/packages";
import { getHomepagePromotion, getLivePublicPromotions } from "@/lib/promotions";
import { getJsonLdContext, getLocalBusinessExtras } from "@/lib/public/data";
import {
  getCollectionPoints,
  getDeliveryAreas,
  getFeaturedMeals,
  getGalleryItems,
  getPublicPlans,
  getPublishedFaqs,
  getPublishedMeals,
  getPublishedTestimonials,
  requestNow,
} from "@/lib/public-data";
import { localBusinessJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";
import { isInstagramUrl } from "@/lib/urls";
import { whatsappLink } from "@/lib/whatsapp";

export async function generateMetadata() {
  return staticPageMetadata("home");
}

type LivePromotion = Awaited<ReturnType<typeof getLivePublicPromotions>>[number];
type PublicPlanRow = Awaited<ReturnType<typeof getPublicPlans>>[number];

/**
 * The live offer with a personal deadline ("order within 2 hours") for the
 * top of the homepage, or null when there is none or this visitor's window
 * has ended. The example uses the recommended weekly package.
 */
function heroOffer(
  promos: LivePromotion[],
  plans: PublicPlanRow[],
  windowStart: Date | null,
  now: Date,
  currency: string,
): HeroOfferData | null {
  const p = promos.find((x) => x.personalWindowMinutes);
  if (!p || !p.personalWindowMinutes) return null;
  if (windowStart && windowStart.getTime() + p.personalWindowMinutes * 60_000 <= now.getTime()) return null;
  const money = (cents: number) => formatMoney(cents, currency, { hideZeroDecimals: true });
  const perMeal = p.discountType === "FIRST_WEEK_MEAL_PRICE" ? p.discountValue : null;
  const weekly = plans.filter((x) => isPackage(x) && !x.isSubscription && x.mealsPerWeek && x.priceCents !== null);
  const pkg = weekly.find((x) => x.isRecommended) ?? weekly[0];
  let example: string | null = null;
  if (perMeal !== null && pkg?.mealsPerWeek && pkg.priceCents !== null) {
    const offerPrice = pkg.mealsPerWeek * perMeal;
    if (offerPrice < pkg.priceCents) {
      example = `${pkg.mealsPerWeek} meals for ${money(offerPrice)} instead of ${money(pkg.priceCents)} — save ${money(pkg.priceCents - offerPrice)}`;
    }
  }
  return {
    slug: p.slug,
    title: perMeal !== null ? `First week ${money(perMeal)} a meal` : p.headline,
    example,
    ctaLabel: perMeal !== null ? `Claim ${money(perMeal)} meals` : "Claim the offer",
    windowMinutes: p.personalWindowMinutes,
    endsAt: p.endsAt,
    newCustomersOnly: p.audience === "NEW_CUSTOMERS",
    startedAt: windowStart?.toISOString() ?? null,
    serverNow: now.toISOString(),
  };
}

export default async function HomePage() {
  const now = await requestNow();
  const [settings, content] = await Promise.all([
    getSettings(),
    getContents([
      "home.hero",
      "home.intro",
      "home.benefits",
      "home.featuredMeals",
      "home.howItWorks",
      "home.fulfillment",
      "home.plans",
      "home.instagram",
      "home.testimonials",
      "home.faq",
      "home.finalCta",
      "home.sections",
    ] as const),
  ]);
  const [hero, intro, benefits, featuredMeals, howItWorks, fulfillment, plansContent, instagram, testimonialsContent, faqContent, finalCta, sections] =
    content;
  const currency = settings.business.currency;

  const [heroImage, meals, plans, promo, gallery, testimonials, faqs, areas, points, jsonLdCtx, lbExtras] = await Promise.all([
    getMedia(hero.imageId),
    getFeaturedMeals(sections.featuredMealLimit),
    getPublicPlans(),
    sections.showPromotion ? getHomepagePromotion(now, currency).catch(() => null) : Promise.resolve(null),
    sections.showInstagram ? getGalleryItems({ featuredOnly: true, limit: sections.galleryLimit }) : Promise.resolve([]),
    sections.showTestimonials ? getPublishedTestimonials() : Promise.resolve([]),
    sections.showFaq ? getPublishedFaqs({ homepageOnly: true }) : Promise.resolve([]),
    getDeliveryAreas(),
    getCollectionPoints(),
    getJsonLdContext(),
    getLocalBusinessExtras(),
  ]);

  const [menu, livePromos, windowStart] = await Promise.all([
    getPublishedMeals(),
    getLivePublicPromotions(now, currency).catch(() => []),
    getOfferWindowStart(now),
  ]);
  const offer = heroOffer(livePromos, plans, windowStart, now, currency);
  const perMeal = plans.map((p) => p.perMealCents).filter((v): v is number => v !== null);
  const fromPerMealCents = perMeal.length ? Math.min(...perMeal) : null;
  const proteins = menu.map((m) => m.proteinG).filter((v): v is number => v !== null);
  const maxProtein = proteins.length ? Math.max(...proteins) : null;

  const c = settings.contact;
  const whatsappHref = whatsappLink(c.whatsappNumber, c.whatsappDefaultMessage);
  const instagramUrl = isInstagramUrl(c.instagramUrl) ? c.instagramUrl : null;

  const jsonLd = [
    organizationJsonLd(jsonLdCtx),
    websiteJsonLd(jsonLdCtx),
    localBusinessJsonLd({ ...jsonLdCtx, areas: lbExtras.servedAreas, plans: lbExtras.catalog, currency }),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <ClickTracking />
      <HomeHero
        hero={hero}
        image={heroImage}
        meals={menu.map((m) => ({ ...m, image: m.image ?? m.images[0]?.mediaAsset ?? null }))}
        fromPerMeal={fromPerMealCents !== null ? formatMoney(fromPerMealCents, currency, { hideZeroDecimals: true }) : null}
        maxProtein={maxProtein}
        offer={offer}
      />
      {/* Packages straight after the hero: the main thing visitors come for. */}
      {sections.showPlans && <HomePlans content={plansContent} plans={plans} currency={currency} />}
      {sections.showFeaturedMeals && <HomeFeaturedMeals content={featuredMeals} meals={meals} />}
      {sections.showHowItWorks && <HomeHowItWorks content={howItWorks} />}
      <HomeIntro intro={intro} />
      {sections.showBenefits && <HomeBenefits benefits={benefits} />}
      {sections.showFulfillment && (
        <HomeFulfillment content={fulfillment} areas={areas} points={points} fulfillment={settings.fulfillment} whatsappHref={whatsappHref} />
      )}
      {promo && promo.slug !== offer?.slug && (
        <>
          <TrackInView event="view_promotion" params={{ promotionSlug: promo.slug }} />
          <PromoBanner promo={promo} serverNow={now.toISOString()} />
        </>
      )}
      {sections.showInstagram && (
        <HomeInstagram content={instagram} items={gallery} instagramUrl={instagramUrl} handle={c.instagramHandle} />
      )}
      {sections.showTestimonials && <HomeTestimonials content={testimonialsContent} items={testimonials} />}
      {sections.showFaq && <HomeFaq content={faqContent} faqs={faqs} whatsappHref={whatsappHref} />}
      {sections.showFinalCta && <HomeFinalCta content={finalCta} whatsappHref={whatsappHref} />}
      <StickyCta href="/order" label="Build your package" note={fromPerMealCents !== null ? `From ${formatMoney(fromPerMealCents, currency, { hideZeroDecimals: true })} a meal · no payment online` : "No payment taken online"} />
    </>
  );
}
