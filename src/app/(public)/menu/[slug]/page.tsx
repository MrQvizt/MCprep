import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { TrackOnMount } from "@/components/analytics/tracked-link";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { CtaLink } from "@/components/public/cta-link";
import { CtaBand } from "@/components/public/cta-band";
import { MealCard } from "@/components/public/meal-card";
import { MacroStrip } from "@/components/public/nutrition";
import { Section, TextBlock } from "@/components/public/section";
import { MediaImage } from "@/components/shared/media-image";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { getMealBySlug, getPublishedMeals } from "@/lib/public-data";
import { buildMetadata, titleWithSuffix } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/menu/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const meal = await getMealBySlug(slug);
  if (!meal) return { title: "Meal not found", robots: { index: false } };
  const macros = [
    meal.calories !== null ? `${meal.calories} kcal` : null,
    meal.proteinG !== null ? `${meal.proteinG}g protein` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const image = meal.image ?? meal.images[0]?.mediaAsset ?? null;
  return buildMetadata({
    title: meal.seoTitle || (await titleWithSuffix(`${meal.name}${macros ? ` (${macros})` : ""}`)),
    description:
      meal.seoDescription ||
      `${meal.name} from the MC PREPS menu${macros ? ` — ${macros}` : ""}. Macro-tracked meal prep in Malta with collection and delivery.`,
    path: `/menu/${meal.slug}`,
    ogImage: image ? { url: image.url, width: image.width, height: image.height, alt: image.altText ?? meal.name } : null,
  });
}

export default async function MealPage({ params }: PageProps<"/menu/[slug]">) {
  const { slug } = await params;
  const meal = await getMealBySlug(slug);
  if (!meal) notFound();
  const [menuCrumb, others, whatsappHref] = await Promise.all([
    crumbFor("menu"),
    getPublishedMeals({ limit: 4 }),
    getWhatsappHref(),
  ]);
  const images = [meal.image, ...meal.images.map((i) => i.mediaAsset)].filter(
    (m, i, arr): m is NonNullable<typeof m> => Boolean(m) && arr.findIndex((x) => x?.id === m!.id) === i,
  );
  const more = others.filter((m) => m.id !== meal.id).slice(0, 3);
  const hasNutrition = [meal.calories, meal.proteinG, meal.carbsG, meal.fatG].some((v) => v !== null);

  return (
    <>
      <TrackOnMount event="view_meal" params={{ mealSlug: meal.slug }} />
      <article>
        <div className="border-b border-white/10 bg-ink">
          <div className="container-site pt-8 sm:pt-10">
            <Breadcrumbs items={[menuCrumb, { name: meal.name, path: `/menu/${meal.slug}` }]} />
          </div>
          <div className="container-site grid gap-10 pb-16 pt-10 lg:grid-cols-2 lg:gap-16 lg:pb-24">
            <div className="space-y-2">
              <MediaImage
                media={images[0] ?? null}
                alt={images[0]?.altText ?? meal.name}
                priority
                sizes="(min-width:1024px) 50vw, 100vw"
                className="aspect-[4/5] w-full"
                placeholderLabel={`${meal.name} — photo coming soon`}
              />
              {images.length > 1 && (
                <ul className="grid grid-cols-4 gap-2">
                  {images.slice(1, 5).map((img) => (
                    <li key={img.id}>
                      <MediaImage media={img} alt={img.altText ?? meal.name} sizes="12vw" className="aspect-square w-full" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col lg:pt-6">
              {meal.label && <p className="eyebrow mb-4 text-fog">{meal.label}</p>}
              <h1 className="display-xl text-balance">{meal.name}</h1>
              {meal.shortDescription && <p className="mt-6 text-lg leading-relaxed text-white/80">{meal.shortDescription}</p>}

              {hasNutrition && (
                <section aria-labelledby="nutrition-title" className="mt-10">
                  <h2 id="nutrition-title" className="eyebrow mb-3 text-fog">
                    Nutrition{meal.servingSize ? ` · per ${meal.servingSize}` : " · per meal"}
                  </h2>
                  <MacroStrip meal={meal} />
                  <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-fog">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {meal.nutritionVerified
                      ? "Values provided by MC PREPS for guidance; they may vary slightly between batches."
                      : "Values are provided for guidance and may vary slightly between batches."}
                  </p>
                </section>
              )}

              {meal.description && <TextBlock text={meal.description} className="mt-8 text-white/80" />}

              {(meal.ingredients || meal.allergens.length > 0 || meal.dietaryTags.length > 0) && (
                <dl className="mt-8 space-y-5 border-t border-white/10 pt-8 text-sm">
                  {meal.ingredients && (
                    <div>
                      <dt className="eyebrow text-fog">Ingredients</dt>
                      <dd className="mt-2 leading-relaxed text-white/85">{meal.ingredients}</dd>
                    </div>
                  )}
                  {meal.allergens.length > 0 && (
                    <div>
                      <dt className="eyebrow text-fog">Contains</dt>
                      <dd className="mt-2 font-semibold">{meal.allergens.join(", ")}</dd>
                    </div>
                  )}
                  {meal.dietaryTags.length > 0 && (
                    <div>
                      <dt className="eyebrow text-fog">Dietary</dt>
                      <dd className="mt-2 flex flex-wrap gap-1.5">
                        {meal.dietaryTags.map((t) => (
                          <span key={t} className="border border-white/20 px-2 py-0.5 text-xs uppercase tracking-[0.1em]">
                            {t}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              <p className="mt-8 text-xs leading-relaxed text-fog">
                Allergies or intolerances? Tell us in your order request and we&apos;ll confirm what&apos;s suitable before your order is confirmed.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <CtaLink href="/order" size="lg" data-track="meal_build_package">
                  Build your package
                </CtaLink>
                <CtaLink href="/menu" variant="outline" size="lg" arrow={false} className="border-white/40">
                  <span className="inline-flex items-center gap-2">
                    <ArrowLeft className="size-4" aria-hidden="true" /> Full menu
                  </span>
                </CtaLink>
              </div>
            </div>
          </div>
        </div>
      </article>

      {more.length > 0 && (
        <Section tone="charcoal" aria-labelledby="more-meals">
          <div className="flex items-end justify-between gap-6">
            <h2 id="more-meals" className="display-lg">
              More from the menu
            </h2>
            <Link href="/menu" className="hidden text-xs font-semibold uppercase tracking-[0.16em] underline-offset-8 hover:underline sm:block">
              View all
            </Link>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {more.map((m) => (
              <li key={m.id}>
                <MealCard meal={m} className="h-full" />
              </li>
            ))}
          </ul>
        </Section>
      )}
      <CtaBand whatsappHref={whatsappHref} />
    </>
  );
}
