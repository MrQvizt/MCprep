"use client";

import { useEffect, useRef } from "react";
import type { AnalyticsEventName, AnalyticsParams } from "@/lib/analytics/events";
import { useTrack } from "@/components/analytics/analytics-provider";

/** Fires an analytics event once, when the marker scrolls into view. */
export function TrackInView({ event, params }: { event: AnalyticsEventName; params?: AnalyticsParams }) {
  const ref = useRef<HTMLSpanElement>(null);
  const track = useTrack();
  const key = JSON.stringify(params ?? {});
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        track(event, JSON.parse(key) as AnalyticsParams);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [event, key, track]);
  return <span ref={ref} aria-hidden="true" className="pointer-events-none block h-px w-px" />;
}
