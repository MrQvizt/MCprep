import { TrackOnMount } from "@/components/analytics/tracked-link";
import { ClickTracking } from "@/components/public/click-tracking";
import { CtaBand } from "@/components/public/cta-band";
import { FaqList } from "@/components/public/faq-list";
import { PlansGrid } from "@/components/public/home/fulfillment-plans";
import { PackagesShowcase } from "@/components/public/package-card";
import { PageHero } from "@/components/public/page-hero";
import { PromoStrip } from "@/components/public/promo-strip";
import { Section } from "@/components/public/section";
import { getContent } from "@/lib/content";
import { formatMoney } from "@/lib/money";
import { isPackage, packageLabel, weeksInPeriod } from "@/lib/packages";
import { getLivePublicPromotions } from "@/lib/promotions";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import {
  getPublicPlans,
  getPublishedFaqs,
  requestNow,
} from "@/lib/public-data";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";

export async function generateMetadata() {
  return staticPageMetadata("plans");
}

const ORDERING_CATEGORIES = new Set([
  "ordering",
  "offers",
  "delivery",
  "payment",
]);

export default async function PlansPage() {
  const now = await requestNow();
  const [settings, content, how, plans, faqs, crumb, whatsappHref] =
    await Promise.all([
      getSettings(),
      getContent("page.plans"),
      getContent("home.howItWorks"),
      getPublicPlans(),
      getPublishedFaqs(),
      crumbFor("plans"),
      getWhatsappHref(),
    ]);
  const currency = settings.business.currency;
  const promos = await getLivePublicPromotions(now, currency).catch(() => []);
  const promo = promos[0] ?? null;
  const orderingFaqs = faqs.filter(
    (f) => f.category && ORDERING_CATEGORIES.has(f.category.toLowerCase()),
  );
  const shownFaqs = (orderingFaqs.length > 0 ? orderingFaqs : faqs).slice(0, 6);
  const packages = plans.filter(isPackage);
  const others = plans.filter((p) => !isPackage(p));
  const money = (cents: number) => formatMoney(cents, currency, { hideZeroDecimals: true });

  return (
    <>
      <TrackOnMount event="view_pricing" />
      <ClickTracking />
      <PageHero
        crumbs={[crumb]}
        eyebrow={content.eyebrow}
        title={content.heading}
        intro={content.intro}
      />

      <Section
        tone="ink"
        aria-label="Meal plans"
        className="pt-12 sm:pt-16 lg:pt-20"
      >
        {promo && (
          <PromoStrip
            promo={promo}
            serverNow={now.toISOString()}
            className="mb-14"
            href={`/offers`}
          />
        )}
        {plans.length === 0 ? (
          <p className="border border-dashed border-white/20 px-6 py-16 text-center text-fog">
            Our plans are being updated. Message us and we&apos;ll tell you
            what&apos;s available this week.
          </p>
        ) : (
          <>
            {packages.length > 0 && <PackagesShowcase plans={packages} currency={currency} />}
            {others.length > 0 && <PlansGrid plans={others} currency={currency} className={packages.length > 0 ? "mt-14" : undefined} />}
          </>
        )}
        {content.note && (
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-fog">
            {content.note}
          </p>
        )}

        {packages.length > 1 && (
          <div className="mt-20 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <caption className="mb-5 text-left font-display text-2xl font-extrabold uppercase">Compare packages</caption>
              <thead>
                <tr className="border-b border-white/20 text-xs uppercase tracking-[0.14em] text-fog">
                  <th scope="col" className="py-3 pr-4 font-semibold">Package</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Meals a week</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Per meal</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Price</th>
                  <th scope="col" className="py-3 font-semibold">First-week offer</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.id} className="border-b border-white/10">
                    <th scope="row" className="py-4 pr-4 font-display text-base font-bold uppercase">
                      {packageLabel(p)}
                      <span className="block text-[0.65rem] font-normal tracking-[0.16em] text-fog">
                        {p.isSubscription ? "Monthly subscription" : "Weekly"}
                        {p.isRecommended ? " · Most popular" : ""}
                      </span>
                    </th>
                    <td className="py-4 pr-4 tabular">{p.mealsPerWeek}</td>
                    <td className="py-4 pr-4 font-semibold tabular">{p.perMealCents === null ? "—" : money(p.perMealCents)}</td>
                    <td className="py-4 pr-4 tabular">
                      {p.priceCents === null ? "On request" : `${money(p.priceCents)} ${p.isSubscription ? `/ ${weeksInPeriod(p)} weeks` : "/ week"}`}
                    </td>
                    <td className="py-4 tabular">
                      {p.offer ? (
                        <>
                          {money(p.offer.priceCents)}
                          <span className="ml-2 text-xs text-fog">{p.isSubscription ? `first ${weeksInPeriod(p)} weeks` : "first week"}</span>
                        </>
                      ) : (
                        <span className="text-fog">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section tone="paper" aria-labelledby="ordering-title">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow mb-4 text-smoke">{how.eyebrow}</p>
            <h2 id="ordering-title" className="display-lg">
              How ordering works
            </h2>
          </div>
          <div className="lg:col-span-8">
            <ol className="space-y-8">
              {how.steps.map((s, i) => (
                <li
                  key={s.title}
                  className="grid grid-cols-[3.5rem_1fr] gap-4 border-b border-ink/10 pb-8"
                >
                  <span
                    aria-hidden="true"
                    className="font-display text-4xl font-black leading-none text-ink/15 tabular"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="display-sm">{s.title}</h3>
                    <p className="mt-2 text-smoke">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {how.note && <p className="mt-8 text-sm font-medium">{how.note}</p>}
          </div>
        </div>
      </Section>

      {shownFaqs.length > 0 && (
        <Section tone="ink" aria-labelledby="plans-faq-title">
          <div className="grid gap-12 lg:grid-cols-12">
            <h2 id="plans-faq-title" className="display-lg lg:col-span-4">
              Ordering questions
            </h2>
            <FaqList items={shownFaqs} className="lg:col-span-8" />
          </div>
        </Section>
      )}
      <CtaBand
        title="Not sure which package?"
        body="Message us — we'll help you pick the package that fits your training and schedule."
        ctaLabel="See the menu"
        ctaHref="/menu"
        whatsappHref={whatsappHref}
      />
    </>
  );
}
