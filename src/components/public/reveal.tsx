"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Subtle fade/slide-in as content enters the viewport. Content is fully
 * visible in the server HTML (no-JS and crawlers see everything); only
 * elements that start below the fold are hidden on mount and revealed.
 * Disabled for prefers-reduced-motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section" | "article";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already in view
    el.dataset.reveal = "hidden";
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.reveal = "shown";
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[var(--ease-out-expo)] data-[reveal=hidden]:translate-y-6 data-[reveal=hidden]:opacity-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
