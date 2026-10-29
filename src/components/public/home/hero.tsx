import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ContentOf } from "@/lib/content/schema";
import type { MediaRef } from "@/lib/media";
import type { PublicMeal } from "@/lib/public-data";
import { isSafeHref } from "@/lib/urls";
import { CtaLink } from "../cta-link";
import { MacroStrip } from "../nutrition";

function HeroArt() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-[radial-gradient(75%_65%_at_78%_28%,#2a2a2a_0%,#101010_52%,#080808_100%)]">
      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:64px_64px]" />
      <svg viewBox="0 0 560 320" className="absolute -right-[12%] top-[6%] h-[70%] w-auto text-white/[0.09] sm:-right-[4%] sm:h-[88%]">
        <text
          x="0"
          y="285"
          fontFamily="var(--font-display)"
          fontWeight={900}
          fontSize="330"
          letterSpacing="-18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          MC
        </text>
      </svg>
      <div className="absolute left-[58%] top-0 h-full w-px bg-gradient-to-b from-white/0 via-white/15 to-white/0" />
      <div className="absolute inset-x-0 top-[62%] h-px bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
    </div>
  );
}

function Spotlight({ meal }: { meal: PublicMeal }) {
  return (
    <aside
      aria-label="On the menu"
      className="hidden w-[22rem] border border-white/15 bg-ink/60 p-6 backdrop-blur-md lg:block"
    >
      <p className="eyebrow flex items-center justify-between text-fog">
        On the menu <span className="text-white/40">Macros listed</span>
      </p>
      <p className="mt-4 font-display text-2xl font-extrabold uppercase leading-none">{meal.name}</p>
      <MacroStrip meal={meal} compact className="mt-5" />
      <Link
        href={`/menu/${meal.slug}`}
        className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] hover:underline underline-offset-4"
      >
        View meal <ArrowUpRight className="size-3.5" />
      </Link>
    </aside>
  );
}

export function HomeHero({
  hero,
  image,
  spotlight,
}: {
  hero: ContentOf<"home.hero">;
  image: MediaRef | null;
  spotlight: PublicMeal | null;
}) {
  const primary = isSafeHref(hero.primaryCta.href) ? hero.primaryCta : { label: "Explore meal plans", href: "/plans" };
  const secondary = isSafeHref(hero.secondaryCta.href) ? hero.secondaryCta : { label: "View the menu", href: "/menu" };
  const points = hero.proofPoints.filter(Boolean);
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-ink text-white">
      <div className="absolute inset-0 -z-10">
        {image ? (
          <>
            <Image
              src={image.url}
              alt={hero.imageAlt || image.altText || ""}
              fill
              priority
              sizes="100vw"
              quality={75}
              className="object-cover"
            />
            <div className="absolute inset-0 bg-ink/35" />
          </>
        ) : (
          <HeroArt />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-ink/0" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/10 to-transparent" />
      </div>

      <div className="container-site flex min-h-[calc(92svh-4rem)] flex-col justify-end pb-12 pt-20 sm:pb-16 lg:min-h-[calc(94svh-5rem)] lg:pb-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-5xl">
            <h1 id="hero-title">
              <span className="eyebrow flex items-center gap-3 text-white/85 animate-in fade-in slide-in-from-bottom-2 duration-700">
                <span aria-hidden="true" className="h-px w-10 bg-white" />
                {hero.kicker}
              </span>
              <span className="mt-6 block display-2xl text-balance animate-in fade-in slide-in-from-bottom-4 duration-1000 [animation-fill-mode:both] [animation-delay:80ms]">
                {hero.headline}
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/80 sm:text-xl text-pretty animate-in fade-in duration-1000 [animation-fill-mode:both] [animation-delay:200ms]">
              {hero.subheadline}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row animate-in fade-in duration-1000 [animation-fill-mode:both] [animation-delay:300ms]">
              <CtaLink href={primary.href} size="lg">
                {primary.label}
              </CtaLink>
              <CtaLink href={secondary.href} size="lg" variant="outline" className="border-white/40">
                {secondary.label}
              </CtaLink>
            </div>
          </div>
          {spotlight && <Spotlight meal={spotlight} />}
        </div>
      </div>

      {points.length > 0 && (
        <div className="relative border-y border-white/10 bg-ink/80 backdrop-blur-sm">
          <div className="flex overflow-hidden py-4" aria-label="Highlights">
            {[0, 1].map((copy) => (
              <ul
                key={copy}
                aria-hidden={copy === 1 ? true : undefined}
                className="flex shrink-0 animate-marquee items-center gap-10 pr-10 motion-reduce:animate-none"
              >
                {[...points, ...points].map((p, i) => (
                  <li key={`${copy}-${i}`} className="flex items-center gap-10 whitespace-nowrap font-display text-sm font-extrabold uppercase tracking-[0.18em] text-white/80">
                    {p}
                    <span aria-hidden="true" className="size-1.5 rotate-45 bg-white/50" />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
