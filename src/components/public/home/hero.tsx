import Image from "next/image";
import type { ContentOf } from "@/lib/content/schema";
import type { MediaRef } from "@/lib/media";
import { isSafeHref } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { CtaLink } from "../cta-link";
import type { MenuCardMeal } from "../menu-card";
import { HeroMenuCarousel } from "./hero-menu-carousel";
import { HeroOffer, type HeroOfferData } from "./hero-offer";

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

export function HomeHero({
  hero,
  image,
  meals,
  fromPerMeal,
  maxProtein,
  offer = null,
}: {
  hero: ContentOf<"home.hero">;
  image: MediaRef | null;
  meals: MenuCardMeal[];
  /** Cheapest price per meal across packages, formatted (e.g. "€8.04"). */
  fromPerMeal: string | null;
  maxProtein: number | null;
  /** Live "order within 2 hours" offer, shown first. */
  offer?: HeroOfferData | null;
}) {
  const primary = isSafeHref(hero.primaryCta.href) ? hero.primaryCta : { label: "Build your package", href: "/order" };
  const secondary = isSafeHref(hero.secondaryCta.href) ? hero.secondaryCta : { label: "See the menu", href: "/menu" };
  const points = hero.proofPoints.filter(Boolean);
  const facts = [
    fromPerMeal ? { value: fromPerMeal, label: "a meal, from" } : null,
    maxProtein ? { value: `${Math.round(maxProtein)}g`, label: "protein, up to" } : null,
    meals.length > 0 ? { value: String(meals.length), label: "dishes on the menu" } : null,
  ].filter((f): f is { value: string; label: string } => f !== null);

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
            <div className="absolute inset-0 bg-ink/55" />
          </>
        ) : (
          <HeroArt />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-ink/0" />
      </div>

      {offer && (
        <div className="container-site pt-5 sm:pt-8">
          <HeroOffer offer={offer} />
        </div>
      )}
      <div
        className={cn(
          "container-site grid gap-12 pb-14 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pb-20",
          offer ? "pt-10 sm:pt-12" : "pt-12 sm:pt-16 lg:min-h-[calc(92svh-5rem)]",
        )}
      >
        <div className="lg:col-span-7">
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
            <CtaLink href={primary.href} size="lg" data-track="hero_primary_cta">
              {primary.label}
            </CtaLink>
            <CtaLink href={secondary.href} size="lg" variant="outline" className="border-white/40">
              {secondary.label}
            </CtaLink>
          </div>
          {facts.length > 0 && (
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/15 pt-6 animate-in fade-in duration-1000 [animation-fill-mode:both] [animation-delay:400ms]">
              {facts.map((f) => (
                <div key={f.label} className="flex flex-col-reverse justify-end">
                  <dt className="mt-1 text-[0.62rem] uppercase tracking-[0.18em] text-white/55">{f.label}</dt>
                  <dd className="font-display text-3xl font-black tabular leading-none sm:text-4xl">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {meals.length > 0 && (
          <div className="mx-auto w-full max-w-[26rem] lg:col-span-5 lg:mr-0 animate-in fade-in slide-in-from-bottom-6 duration-1000 [animation-fill-mode:both] [animation-delay:250ms]">
            <HeroMenuCarousel meals={meals} />
          </div>
        )}
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
