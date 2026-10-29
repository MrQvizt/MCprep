import { cn } from "@/lib/utils";

export interface NutritionValues {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** Macro strip: only shows values that have been provided (never invented). */
export function MacroStrip({ meal, className, compact = false }: { meal: NutritionValues; className?: string; compact?: boolean }) {
  const items = [
    meal.calories !== null && { label: "kcal", value: String(meal.calories), long: "Calories" },
    meal.proteinG !== null && { label: "Protein", value: `${fmt(meal.proteinG)}g`, long: "Protein" },
    meal.carbsG !== null && { label: "Carbs", value: `${fmt(meal.carbsG)}g`, long: "Carbohydrates" },
    meal.fatG !== null && { label: "Fat", value: `${fmt(meal.fatG)}g`, long: "Fat" },
  ].filter(Boolean) as { label: string; value: string; long: string }[];
  if (items.length === 0) return null;
  return (
    <dl className={cn("grid grid-cols-4 divide-x divide-current/15 border-y border-current/15", className)}>
      {items.map((i) => (
        <div key={i.label} className={cn("flex flex-col items-center justify-center text-center", compact ? "py-2" : "py-3")}>
          <dt className="order-2 text-[0.62rem] uppercase tracking-[0.16em] text-current/60">
            <abbr title={i.long} className="no-underline">
              {i.label}
            </abbr>
          </dt>
          <dd className={cn("order-1 font-display font-black tabular leading-none", compact ? "text-base" : "text-xl")}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
