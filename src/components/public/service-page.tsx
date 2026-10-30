import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getContent, type ContentKey, type ContentOf } from "@/lib/content";
import { getMedia } from "@/lib/media";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { getFeaturedMeals, getPublicPlans } from "@/lib/public-data";
import { faqJsonLd } from "@/lib/seo/jsonld";
import type { StaticPageKey } from "@/lib/seo/pages";
import { getSettings } from "@/lib/settings";
import { isSafeHref } from "@/lib/urls";
import { MediaImage } from "@/components/shared/media-image";
import { JsonLd } from "@/components/shared/json-ld";
import { ClickTracking } from "./click-tracking";
import { CtaBand } from "./cta-band";
import { CtaLink } from "./cta-link";
import { FaqList } from "./faq-list";
import { MealSpotlight } from "./home/meals-steps";
import { PlansGrid } from "./home/fulfillment-plans";
import { MealCard } from "./meal-card";
import { PageHero } from "./page-hero";
import { Reveal } from "./reveal";
import { Section, TextBlock } from "./section";

type ServiceKey = Extract<ContentKey, `service.${string}`>;

export const SERVICE_LINKS: { key: StaticPageKey; href: string; label: string; blurb: string }[] = [
  { key: "meal-prep-malta", href: "/meal-prep-malta", label: "Meal prep Malta", blurb: "What MC PREPS meal prep is and how it works." },
  { key: "healthy-meal-delivery-malta", href: "/healthy-meal-delivery-malta", label: "Healthy meal delivery", blurb: "Delivery areas, days and collection." },
  { key: "meal-plans-malta", href: "/meal-plans-malta", label: "Meal plans Malta", blurb: "Which plan is right for you." },
  { key: "high-protein-meals-malta", href: "/high-protein-meals-malta", label: "High-protein meals", blurb: "Macro-counted meals for lifters." },
  { key: "delivery-areas", href: "/delivery-areas", label: "Delivery areas", blurb: "Localities we currently deliver to." },
];

/** Renders an SEO landing page (Meal Prep Malta, etc.) from structured content. */
export async function ServicePage({ contentKey, pageKey }: { contentKey: ServiceKey; pageKey: StaticPageKey }) {
  const [content, hero, crumb, settings, whatsappHref] = await Promise.all([
    getContent(contentKey) as Promise<ContentOf<"service.mealPrepMalta">>,
    getContent("home.hero"),
    crumbFor(pageKey),
    getSettings(),
    getWhatsappHref(),
  ]);
  const [image, plans, meals] = await Promise.all([
    getMedia(content.imageId),
    content.showPlans ? getPublicPlans() : Promise.resolve([]),
    content.showMeals ? getFeaturedMeals(3) : Promise.resolve([]),
  ]);
  const cta = isSafeHref(content.cta.href) ? content.cta : { label: "Build your package", href: "/order" };
  const related = SERVICE_LINKS.filter((l) => l.key !== pageKey);

  return (
    <>
      <JsonLd data={faqJsonLd(content.faqs)} />
      <ClickTracking />
      <PageHero
        crumbs={[crumb]}
        eyebrow={content.eyebrow}
        title={content.h1}
        intro={content.intro}
        size="lg"
        aside={
          image ? (
            <MediaImage media={image} alt={image.altText ?? content.h1} priority sizes="(min-width:1024px) 35vw, 100vw" className="aspect-[4/3] w-full" />
          ) : hero.proofPoints.length > 0 ? (
            <ul className="hidden border-t border-white/15 lg:block" aria-label="Highlights">
              {hero.proofPoints.map((p, i) => (
                <li key={p} className="flex items-baseline justify-between gap-6 border-b border-white/15 py-4">
                  <span className="font-display text-xl font-extrabold uppercase">{p}</span>
                  <span className="font-display text-xs font-bold text-white/40 tabular">{String(i + 1).padStart(2, "0")}</span>
                </li>
              ))}
            </ul>
          ) : undefined
        }
      >
        <CtaLink href={cta.href} size="lg">
          {cta.label}
        </CtaLink>
      </PageHero>

      <Section tone="paper" aria-label={content.h1}>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="space-y-14 lg:col-span-8">
            {content.sections.map((s, i) => (
              <Reveal key={s.heading} delay={i === 0 ? 0 : 60}>
                <section aria-labelledby={`s-${i}`}>
                  <h2 id={`s-${i}`} className="display-md">
                    {s.heading}
                  </h2>
                  <TextBlock text={s.body} className="mt-4 max-w-2xl text-lg leading-relaxed text-ink/80" />
                </section>
              </Reveal>
            ))}
          </div>
          <aside aria-label="Related pages" className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow mb-4 text-smoke">Also useful</p>
              <ul className="border-t border-ink/15">
                {related.map((l) => (
                  <li key={l.href} className="border-b border-ink/15">
                    <Link href={l.href} className="group flex items-start justify-between gap-4 py-4">
                      <span>
                        <span className="block font-display text-base font-bold uppercase">{l.label}</span>
                        <span className="mt-1 block text-sm text-smoke">{l.blurb}</span>
                      </span>
                      <ArrowUpRight className="mt-1 size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
                <li className="border-b border-ink/15">
                  <Link href="/menu" className="group flex items-start justify-between gap-4 py-4">
                    <span>
                      <span className="block font-display text-base font-bold uppercase">The menu</span>
                      <span className="mt-1 block text-sm text-smoke">Meals with calories and macros listed.</span>
                    </span>
                    <ArrowUpRight className="mt-1 size-4 shrink-0" />
                  </Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </Section>

      {meals.length > 0 && (
        <Section tone="charcoal" aria-labelledby="svc-meals">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="svc-meals" className="display-lg">
              From the menu
            </h2>
            <CtaLink href="/menu" variant="outline" className="border-white/40">
              Full menu
            </CtaLink>
          </div>
          <div className="mt-10">
            {meals.length === 1 ? (
              <MealSpotlight meal={meals[0]} />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                {meals.map((m) => (
                  <li key={m.id}>
                    <MealCard meal={m} className="h-full" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}

      {plans.length > 0 && (
        <Section tone="ink" aria-labelledby="svc-plans">
          <h2 id="svc-plans" className="display-lg text-center">
            Meal plans
          </h2>
          <PlansGrid plans={plans} currency={settings.business.currency} className="mt-12" />
        </Section>
      )}

      {content.faqs.length > 0 && (
        <Section tone="mist" aria-labelledby="svc-faq">
          <div className="grid gap-10 lg:grid-cols-12">
            <h2 id="svc-faq" className="display-lg lg:col-span-4">
              Questions
            </h2>
            <FaqList items={content.faqs} className="lg:col-span-8" />
          </div>
        </Section>
      )}
      <CtaBand whatsappHref={whatsappHref} tone="paper" />
    </>
  );
}
