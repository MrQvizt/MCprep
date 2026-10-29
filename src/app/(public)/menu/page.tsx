import { Info, Utensils } from "lucide-react";
import { ClickTracking } from "@/components/public/click-tracking";
import { CtaBand } from "@/components/public/cta-band";
import { MealSpotlight } from "@/components/public/home/meals-steps";
import { MealCard } from "@/components/public/meal-card";
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
                <MealCard meal={meal} className="h-full" priority={i < 3} />
              </Reveal>
            ))}
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
