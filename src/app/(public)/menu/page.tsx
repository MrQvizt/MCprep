import { Info, Utensils } from "lucide-react";
import { ClickTracking } from "@/components/public/click-tracking";
import { CtaBand } from "@/components/public/cta-band";
import { MealSpotlight } from "@/components/public/home/meals-steps";
import { CtaLink } from "@/components/public/cta-link";
import { MenuCard } from "@/components/public/menu-card";
import { PageHero } from "@/components/public/page-hero";
import { Reveal } from "@/components/public/reveal";
import { Section } from "@/components/public/section";
import { getContent } from "@/lib/content";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { getPublishedMeals } from "@/lib/public-data";
import { staticPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return staticPageMetadata("menu");
}

export default async function MenuPage() {
  const [content, meals, crumb, whatsappHref] = await Promise.all([
    getContent("page.menu"),
    getPublishedMeals(),
    crumbFor("menu"),
    getWhatsappHref(),
  ]);
  return (
    <>
      <ClickTracking />
      <PageHero crumbs={[crumb]} eyebrow={content.eyebrow} title={content.heading} intro={content.intro} />
      <Section tone="charcoal" aria-label="Meals">
        {meals.length === 0 ? (
          <div className="flex flex-col items-center border border-dashed border-white/20 px-6 py-20 text-center">
            <Utensils className="size-8 text-fog" aria-hidden="true" />
            <h2 className="mt-5 display-md">The menu is being updated</h2>
            <p className="mt-3 max-w-md text-fog">
              New meals are on their way. Follow us on Instagram or message us to hear what&apos;s cooking this week.
            </p>
          </div>
        ) : meals.length === 1 ? (
          <MealSpotlight meal={meals[0]} headingLevel="h2" />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {meals.map((meal, i) => (
              <Reveal as="li" key={meal.id} delay={(i % 3) * 70}>
                <MenuCard
                  meal={{ ...meal, image: meal.image ?? meal.images[0]?.mediaAsset ?? null }}
                  index={i}
                  total={meals.length}
                  priority={i < 3}
                  headingLevel="h2"
                  className="h-full"
                />
              </Reveal>
            ))}
            <Reveal as="li" delay={(meals.length % 3) * 70} className={meals.length % 3 === 0 ? "sm:col-span-2 lg:col-span-3" : undefined}>
              <div className="flex h-full min-h-56 flex-col justify-between gap-8 border border-white/15 p-6 sm:p-8">
                <div>
                  <p className="eyebrow text-fog">Mix &amp; match</p>
                  <p className="mt-4 font-display text-3xl font-black uppercase leading-[0.95]">Choose any combination</p>
                  <p className="mt-3 max-w-sm text-sm text-white/70">
                    Build your package, then pick how many of each dish you want every week.
                  </p>
                </div>
                <CtaLink href="/order" className="self-start" data-track="menu_build_package">
                  Build your package
                </CtaLink>
              </div>
            </Reveal>
          </ul>
        )}
        {content.nutritionNote && (
          <p className="mt-12 flex max-w-3xl items-start gap-3 text-sm leading-relaxed text-fog">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {content.nutritionNote}
          </p>
        )}
      </Section>
      <CtaBand whatsappHref={whatsappHref} />
    </>
  );
}
