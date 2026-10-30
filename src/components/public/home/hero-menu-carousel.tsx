"use client";

import { useEffect, useState } from "react";
import { MenuCard, type MenuCardMeal } from "../menu-card";
import { cn } from "@/lib/utils";

/** Cycles through the menu cards in the hero (paused on hover/focus and for reduced motion). */
export function HeroMenuCarousel({ meals }: { meals: MenuCardMeal[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (meals.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % meals.length), 4500);
    return () => window.clearInterval(id);
  }, [meals.length, paused]);

  if (meals.length === 0) return null;
  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="grid border border-white/15 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
        {meals.map((meal, i) => (
          <div
            key={meal.slug}
            aria-hidden={i !== active}
            inert={i !== active}
            className={cn(
              "col-start-1 row-start-1 transition-opacity duration-700",
              i === active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <MenuCard meal={meal} index={i} total={meals.length} priority={i === 0} sizes="(min-width:1024px) 420px, 100vw" headingLevel="p" />
          </div>
        ))}
      </div>
      {meals.length > 1 && (
        <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Menu dishes">
          {meals.map((meal, i) => (
            <button
              key={meal.slug}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={meal.name}
              onClick={() => setActive(i)}
              className={cn("h-1.5 transition-all", i === active ? "w-8 bg-white" : "w-4 bg-white/30 hover:bg-white/60")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
