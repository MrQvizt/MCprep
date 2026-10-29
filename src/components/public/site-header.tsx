"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo, type BrandAssetsLite } from "@/components/brand/logo";
import { InstagramIcon, WhatsAppIcon } from "@/components/shared/icons";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

export function SiteHeader({
  brand,
  nav,
  ctaLabel = "Build your package",
  ctaHref = "/order",
  whatsappHref,
  instagramUrl,
}: {
  brand: BrandAssetsLite;
  nav: NavItem[];
  ctaLabel?: string;
  ctaHref?: string;
  whatsappHref: string | null;
  instagramUrl: string | null;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  // Menu is "open" only for the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) =>
    setOpenOn((prev) => {
      const next = typeof v === "function" ? v(prev === pathname) : v;
      return next ? pathname : null;
    });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      toggleRef.current?.focus();
    }
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 transition-colors duration-300",
          scrolled
            ? "border-b border-white/10 bg-ink/95 backdrop-blur-md"
            : "border-b border-transparent bg-ink/60 backdrop-blur-sm",
        )}
      >
        <div className="container-site flex h-16 items-center justify-between gap-6 lg:h-20">
          <Link
            href="/"
            aria-label={`${brand.logoText} — home`}
            className="shrink-0"
          >
            <Logo brand={brand} priority />
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-7">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "relative text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-white/75 transition-colors hover:text-white",
                      "after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-white after:transition-transform after:duration-300 hover:after:scale-x-100",
                      isActive(item.href) && "text-white after:scale-x-100",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href={ctaHref}
              className="hidden h-10 items-center bg-white px-5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-mist sm:inline-flex"
            >
              {ctaLabel}
            </Link>
            <button
              ref={toggleRef}
              type="button"
              className="inline-grid size-11 place-items-center text-white lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Rendered outside <header>: its backdrop-filter would otherwise trap this fixed overlay. */}
      <div
        id="mobile-nav"
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="fixed inset-0 z-[65] overflow-y-auto bg-ink text-white lg:hidden"
      >
        <div className="container-site flex h-16 items-center justify-between border-b border-white/10">
          <Link
            href="/"
            aria-label={`${brand.logoText} — home`}
            className="shrink-0"
            onClick={() => setOpenOn(null)}
          >
            <Logo brand={brand} />
          </Link>
          <button
            ref={closeRef}
            type="button"
            className="inline-grid size-11 place-items-center text-white"
            aria-label="Close menu"
            onClick={() => setOpenOn(null)}
          >
            <X className="size-6" />
          </button>
        </div>
        <nav
          aria-label="Mobile"
          className="container-site flex flex-col pb-10 pt-6 safe-bottom"
        >
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {nav.map((item, i) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between py-4 font-display text-3xl font-black uppercase tracking-tight text-white animate-in fade-in slide-in-from-bottom-2"
                  style={{
                    animationDelay: `${i * 35}ms`,
                    animationFillMode: "both",
                  }}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  onClick={() => setOpenOn(null)}
                >
                  {item.label}
                  <span aria-hidden="true" className="text-sm text-white/40">
                    0{i + 1}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={ctaHref}
            className="mt-8 inline-flex h-14 items-center justify-center bg-white text-sm font-semibold uppercase tracking-[0.16em] text-ink"
          >
            {ctaLabel}
          </Link>
          <div className="mt-6 flex gap-3">
            {whatsappHref && (
              <TrackedLink
                href={whatsappHref}
                event="click_whatsapp"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 border border-white/20 text-xs font-semibold uppercase tracking-[0.14em] text-white"
              >
                <WhatsAppIcon className="size-5" /> WhatsApp
              </TrackedLink>
            )}
            {instagramUrl && (
              <TrackedLink
                href={instagramUrl}
                event="click_instagram"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 border border-white/20 text-xs font-semibold uppercase tracking-[0.14em] text-white"
              >
                <InstagramIcon className="size-5" /> Instagram
              </TrackedLink>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
