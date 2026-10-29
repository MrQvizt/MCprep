import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface MenuCardMeal {
  slug: string;
  name: string;
  label: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  image: { url: string; altText: string | null } | null;
}

const n = (v: number | null) => (v === null ? "—" : String(Math.round(v)));

/**
 * The MC PREPS "On the menu" card — the same look as the brand's Instagram
 * posts: photo with a numbered badge, black panel with the name and macros.
 */
export function MenuCard({
  meal,
  index,
  total,
  priority,
  sizes = "(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw",
  className,
  linked = true,
  headingLevel: H = "h3",
}: {
  meal: MenuCardMeal;
  index: number;
  total: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
  linked?: boolean;
  headingLevel?: "h2" | "h3" | "p";
}) {
  const dessert = /dessert/i.test(meal.label ?? "");
  const body = (
    <article className={cn("group flex h-full flex-col overflow-hidden bg-ink", className)}>
      <div className="relative aspect-[4/3] overflow-hidden bg-charcoal">
        {meal.image ? (
          <Image
            src={meal.image.url}
            alt={meal.image.altText ?? meal.name}
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
          />
        ) : null}
        <p className="absolute left-3 top-3 bg-ink px-2.5 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-white sm:left-4 sm:top-4">
          {dessert ? "Protein dessert" : "On the menu"}
        </p>
        <p className="absolute right-3 top-3 bg-ink px-2.5 py-1.5 font-display text-[0.65rem] tabular tracking-[0.18em] text-white/80 sm:right-4 sm:top-4">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-5 sm:p-6">
        <H className="font-display text-2xl font-black uppercase leading-[0.95] tracking-tight sm:text-[1.7rem]">{meal.name}</H>
        <dl className="grid grid-cols-4 gap-2 border-t border-white/15 pt-4">
          {(
            [
              ["kcal", n(meal.calories)],
              ["protein", `${n(meal.proteinG)}g`],
              ["carbs", `${n(meal.carbsG)}g`],
              ["fat", `${n(meal.fatG)}g`],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block font-display text-xl font-black tabular leading-none sm:text-2xl">{value}</span>
                <span className="mt-1 block text-[0.58rem] uppercase tracking-[0.2em] text-white/55" aria-hidden="true">
                  {label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
  if (!linked) return body;
  return (
    <Link
      href={`/menu/${meal.slug}`}
      className="block h-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-white"
      aria-label={`${meal.name} — ${n(meal.calories)} kcal, ${n(meal.proteinG)} g protein`}
    >
      {body}
    </Link>
  );
}
