"use client";

import Image from "next/image";
import { Minus, Plus, Shuffle } from "lucide-react";
import { evenSplit, selectionTotal, type MealChoice } from "@/lib/packages";
import { cn } from "@/lib/utils";

export interface DishOption {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  imageAlt: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  label: string | null;
}

const fmt = (v: number | null, unit = "") => (v === null ? "—" : `${Math.round(v)}${unit}`);

/** Choose how many of each dish per week; the total must match the package. */
export function DishPicker({
  dishes,
  perWeek,
  value,
  onChange,
  error,
}: {
  dishes: DishOption[];
  perWeek: number;
  value: MealChoice[];
  onChange: (next: MealChoice[]) => void;
  error?: string;
}) {
  const total = selectionTotal(value);
  const remaining = perWeek - total;
  const qty = (id: string) => value.find((c) => c.mealId === id)?.quantity ?? 0;
  const set = (id: string, quantity: number) => {
    const others = value.filter((c) => c.mealId !== id);
    const next = quantity > 0 ? [...others, { mealId: id, quantity }] : others;
    // Keep menu order so the summary reads naturally.
    onChange(dishes.map((d) => next.find((c) => c.mealId === d.id)).filter((c): c is MealChoice => Boolean(c)));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fog" aria-live="polite">
          <span className="font-display text-2xl font-black tabular text-white">{total}</span>
          <span className="font-display text-2xl font-black text-white/40"> / {perWeek}</span>{" "}
          meals chosen
          {remaining > 0 && <span className="ml-2 text-white">· {remaining} to go</span>}
          {remaining < 0 && <span className="ml-2 text-red-300">· {-remaining} too many</span>}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(evenSplit(dishes.map((d) => d.id), perWeek))}
            className="inline-flex h-9 items-center gap-2 border border-white/30 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] hover:border-white"
          >
            <Shuffle className="size-3.5" aria-hidden="true" /> Mix evenly
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="h-9 border border-white/15 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-fog hover:border-white/50 hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full bg-white/10" aria-hidden="true">
        <div
          className={cn("h-full transition-[width] duration-300", remaining < 0 ? "bg-red-400" : "bg-white")}
          style={{ width: `${Math.min(100, (total / Math.max(perWeek, 1)) * 100)}%` }}
        />
      </div>

      <ul className="mt-5 divide-y divide-white/10 border-y border-white/10">
        {dishes.map((d) => {
          const q = qty(d.id);
          return (
            <li key={d.id} className="flex items-center gap-3 py-3 sm:gap-4">
              <div className="relative size-16 shrink-0 overflow-hidden bg-charcoal sm:size-20">
                {d.imageUrl ? (
                  <Image src={d.imageUrl} alt={d.imageAlt} fill sizes="80px" className="object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-black uppercase leading-tight sm:text-base">{d.name}</p>
                {d.label && <p className="mt-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-fog">{d.label}</p>}
                <p className="mt-1 text-xs tabular text-fog">
                  {fmt(d.calories)} kcal · {fmt(d.proteinG, "g")} P · {fmt(d.carbsG, "g")} C · {fmt(d.fatG, "g")} F
                </p>
              </div>
              <div className="flex shrink-0 items-center" role="group" aria-label={`${d.name} quantity`}>
                <button
                  type="button"
                  onClick={() => set(d.id, Math.max(0, q - 1))}
                  disabled={q === 0}
                  aria-label={`One less ${d.name}`}
                  className="grid size-10 place-items-center border border-white/25 hover:border-white disabled:opacity-30"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span className="w-9 text-center font-display text-lg font-black tabular" aria-live="polite">
                  {q}
                </span>
                <button
                  type="button"
                  onClick={() => set(d.id, q + 1)}
                  disabled={remaining <= 0}
                  aria-label={`One more ${d.name}`}
                  className={cn(
                    "grid size-10 place-items-center border hover:border-white disabled:opacity-30",
                    q > 0 && remaining > 0 ? "border-white bg-white text-ink" : "border-white/25",
                  )}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-fog">The menu changes every few weeks — we&apos;ll message you before a dish you chose changes.</p>
    </div>
  );
}
