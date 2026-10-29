"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Mobile-only sticky call-to-action bar. Appears after the visitor scrolls
 * past the hero and publishes its height so the WhatsApp button sits above it.
 */
export function StickyCta({
  href,
  label,
  note,
  showAfter = 520,
}: {
  href: string;
  label: string;
  note?: string;
  showAfter?: number;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > showAfter);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfter]);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => {
      const h = visible && mq.matches && ref.current ? ref.current.offsetHeight : 0;
      root.style.setProperty("--sticky-cta-h", `${h}px`);
    };
    update();
    mq.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
      root.style.setProperty("--sticky-cta-h", "0px");
    };
  }, [visible]);

  return (
    <div
      ref={ref}
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-ink/95 px-4 pt-3 backdrop-blur-md transition-transform duration-300 md:hidden safe-bottom",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
    >
      <Link
        href={href}
        tabIndex={visible ? 0 : -1}
        className="flex h-12 w-full items-center justify-center bg-white text-xs font-semibold uppercase tracking-[0.16em] text-ink"
      >
        {label}
      </Link>
      {note && <p className="mt-1.5 text-center text-[0.68rem] text-fog">{note}</p>}
    </div>
  );
}
