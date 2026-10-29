"use client";

import { useEffect } from "react";
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/lib/analytics/events";
import { useTrack } from "@/components/analytics/analytics-provider";

/**
 * Records clicks on any element carrying `data-track="<event>"` (plus optional
 * data-track-plan / data-track-meal / data-track-promotion). Lets server
 * components emit analytics events without becoming client components.
 */
export function ClickTracking() {
  const track = useTrack();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-track]") as HTMLElement | null;
      if (!el) return;
      const name = el.dataset.track as AnalyticsEventName;
      if (!ANALYTICS_EVENTS.includes(name)) return;
      track(name, {
        planSlug: el.dataset.trackPlan || undefined,
        mealSlug: el.dataset.trackMeal || undefined,
        promotionSlug: el.dataset.trackPromotion || undefined,
      });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [track]);
  return null;
}
