import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { MediaImage } from "@/components/shared/media-image";
import type { ContentOf } from "@/lib/content/schema";
import type { PublicMeal } from "@/lib/public-data";
import { cn } from "@/lib/utils";
import { CtaLink } from "../cta-link";
import { MenuCard } from "../menu-card";
import { MacroStrip } from "../nutrition";
import { Reveal } from "../reveal";
import { Section } from "../section";

/** Large editorial layout used when only one meal is featured. */
export function MealSpotlight({
  meal,
  headingLevel: H = "h3",
}: {
  meal: PublicMeal;
  headingLevel?: "h2" | "h3";
}) {
  const image = meal.image ?? meal.images[0]?.mediaAsset ?? null;
  return (
    <article className="group grid overflow-hidden border border-white/10 bg-ink lg:grid-cols-2">
      <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[16/11] lg:aspect-auto lg:min-h-[34rem]">
        <MediaImage
          media={image}
          alt={image?.altText ?? meal.name}
          sizes="(min-width:1024px) 50vw, 100vw"
          className="absolute inset-0"
          imgClassName="transition-transform duration-1000 ease-[var(--ease-out-expo)] group-hover:scale-105"
          placeholderLabel={`${meal.name} — photo coming soon`}
        />
        {(meal.label || meal.isFeatured) && (
          <p className="absolute left-5 top-5 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink">
            {meal.label || "Featured"}
          </p>
        )}
      </div>
      <div className="flex flex-col justify-between gap-10 p-7 sm:p-10 lg:p-14">
        <div>
          <p className="eyebrow text-fog">Macro-tracked</p>
          <H className="mt-4 display-lg">{meal.name}</H>
          {(meal.description || meal.shortDescription) && (
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/75">
              {meal.description || meal.shortDescription}
            </p>
          )}
        </div>
        <div>
          <MacroStrip meal={meal} className="border-white/15" />
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink
              href={`/menu/${meal.slug}`}
              variant="outline"
              size="md"
              className="border-white/40"
            >
              Meal details
            </CtaLink>
          </div>
        </div>
      </div>
    </article>
  );
}

export function HomeFeaturedMeals({
  content,
  meals,
}: {
  content: ContentOf<"home.featuredMeals">;
  meals: PublicMeal[];
}) {
  if (meals.length === 0) return null;
  return (
    <Section tone="charcoal" aria-labelledby="meals-title">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-4xl">
          <p className="eyebrow mb-4 text-fog">{content.eyebrow}</p>
          <h2 id="meals-title" className="display-xl text-balance">
            {content.heading}
          </h2>
          {content.subheading && (
            <p className="mt-5 text-base text-white/70 sm:text-lg">
              {content.subheading}
            </p>
          )}
        </div>
        <CtaLink
          href="/menu"
          variant="outline"
          className="shrink-0 self-start border-white/40 md:self-end"
        >
          {content.ctaLabel}
        </CtaLink>
      </div>
      <div className="mt-12 lg:mt-16">
        {meals.length === 1 ? (
          <Reveal>
            <MealSpotlight meal={meals[0]} />
          </Reveal>
        ) : (
          <ul
            className={cn(
              "grid gap-4 sm:gap-6",
              meals.length === 2
                ? "sm:grid-cols-2"
                : "sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {meals.map((meal, i) => (
              <Reveal as="li" key={meal.id} delay={(i % 3) * 80}>
                <MenuCard meal={{ ...meal, image: meal.image ?? meal.images[0]?.mediaAsset ?? null }} index={i} total={meals.length} className="h-full" />
              </Reveal>
            ))}
            <Reveal as="li" delay={(meals.length % 3) * 80} className={cn(meals.length % 3 === 0 && "sm:col-span-2 lg:col-span-3")}>
              <div className="flex h-full min-h-56 flex-col justify-between gap-8 border border-white/15 p-6 sm:p-8">
                <div>
                  <p className="eyebrow text-fog">Your week, your mix</p>
                  <p className="mt-4 font-display text-3xl font-black uppercase leading-[0.95]">Pick any combination</p>
                  <p className="mt-3 max-w-sm text-sm text-white/70">
                    Choose how many of each dish you want in your package — or mix them evenly in one tap.
                  </p>
                </div>
                <CtaLink href="/order" className="self-start">
                  Build your package
                </CtaLink>
              </div>
            </Reveal>
          </ul>
        )}
      </div>
    </Section>
  );
}

export function HomeHowItWorks({
  content,
}: {
  content: ContentOf<"home.howItWorks">;
}) {
  if (content.steps.length === 0) return null;
  return (
    <Section tone="paper" aria-labelledby="how-title">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="eyebrow mb-4 text-smoke">{content.eyebrow}</p>
          <h2 id="how-title" className="display-lg text-balance">
            {content.heading}
          </h2>
          <Link
            href="/how-it-works"
            className="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] underline-offset-8 hover:underline"
          >
            The full process <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="lg:col-span-8">
          <ol className="grid border-l border-t border-ink/10 sm:grid-cols-3">
            {content.steps.map((step, i) => (
              <Reveal
                as="li"
                key={step.title}
                delay={i * 90}
                className="flex flex-col border-b border-r border-ink/10 bg-paper p-6 sm:p-7"
              >
                <span
                  aria-hidden="true"
                  className="font-display text-6xl font-black leading-none text-ink/10 tabular sm:text-7xl"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-6 display-sm">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-smoke">
                  {step.body}
                </p>
              </Reveal>
            ))}
          </ol>
          {content.note && (
            <p className="mt-8 flex items-start gap-3 bg-mist px-5 py-4 text-sm font-medium text-ink/85">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {content.note}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
