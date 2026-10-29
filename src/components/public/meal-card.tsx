import Link from "next/link";
import { MediaImage } from "@/components/shared/media-image";
import type { PublicMeal } from "@/lib/public-data";
import { cn } from "@/lib/utils";
import { MacroStrip } from "./nutrition";

export function MealCard({ meal, className, priority }: { meal: PublicMeal; className?: string; priority?: boolean }) {
  const image = meal.image ?? meal.images[0]?.mediaAsset ?? null;
  return (
    <article className={cn("group relative flex flex-col bg-charcoal text-white", className)}>
      <div className="relative aspect-[4/5] overflow-hidden">
        <MediaImage
          media={image}
          alt={image?.altText ?? meal.name}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="absolute inset-0"
          imgClassName="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-105"
          priority={priority}
          placeholderLabel={`${meal.name} — photo coming soon`}
        />
        {(meal.label || meal.isFeatured) && (
          <p className="absolute left-4 top-4 bg-white px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink">
            {meal.label || "Featured"}
          </p>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="display-sm">
          <Link href={`/menu/${meal.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {meal.name}
          </Link>
        </h3>
        {meal.shortDescription && <p className="mt-2 line-clamp-2 text-sm text-fog">{meal.shortDescription}</p>}
        <MacroStrip meal={meal} compact className="mt-5" />
        {(meal.dietaryTags.length > 0 || meal.allergens.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-1.5 text-[0.65rem] uppercase tracking-[0.12em]">
            {meal.dietaryTags.map((t) => (
              <span key={t} className="border border-white/20 px-2 py-0.5">
                {t}
              </span>
            ))}
            {meal.allergens.length > 0 && (
              <span className="px-0.5 py-0.5 text-fog normal-case tracking-normal">Contains: {meal.allergens.join(", ")}</span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
