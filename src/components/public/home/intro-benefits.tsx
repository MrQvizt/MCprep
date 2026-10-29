import { Dumbbell, Flame, MessageCircle, Salad, Sparkles, Target, Timer, Truck, Utensils, type LucideIcon } from "lucide-react";
import type { ContentOf } from "@/lib/content/schema";
import { Reveal } from "../reveal";
import { Section, TextBlock } from "../section";

const ICONS: Record<string, LucideIcon> = {
  flame: Flame,
  target: Target,
  dumbbell: Dumbbell,
  truck: Truck,
  "message-circle": MessageCircle,
  utensils: Utensils,
  timer: Timer,
  salad: Salad,
  sparkles: Sparkles,
};

export function HomeIntro({ intro }: { intro: ContentOf<"home.intro"> }) {
  return (
    <Section tone="paper" aria-labelledby="intro-title">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <p className="eyebrow mb-5 text-smoke">MC PREPS · Malta</p>
          <h2 id="intro-title" className="display-lg text-balance">
            {intro.heading}
          </h2>
        </Reveal>
        <Reveal className="lg:col-span-7" delay={100}>
          <TextBlock text={intro.body} className="text-lg leading-relaxed text-ink/80 sm:text-xl [&>p:first-child]:font-medium [&>p:first-child]:text-ink" />
        </Reveal>
      </div>
    </Section>
  );
}

export function HomeBenefits({ benefits }: { benefits: ContentOf<"home.benefits"> }) {
  if (benefits.items.length === 0) return null;
  return (
    <Section tone="ink" aria-labelledby="benefits-title">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow mb-4 text-fog">{benefits.eyebrow}</p>
          <h2 id="benefits-title" className="display-xl max-w-5xl text-balance">
            {benefits.heading}
          </h2>
        </div>
      </div>
      <ul className="mt-14 grid border-l border-t border-white/10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-5">
        {benefits.items.map((item, i) => {
          const Icon = ICONS[item.icon] ?? Sparkles;
          return (
            <Reveal as="li" key={item.title} delay={i * 70} className="group flex flex-col border-b border-r border-white/10 bg-ink p-6 transition-colors duration-500 hover:bg-charcoal sm:p-7">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold tabular text-white/40">{String(i + 1).padStart(2, "0")}</span>
                <Icon className="size-6 text-white/80 transition-transform duration-500 group-hover:-translate-y-0.5" aria-hidden="true" />
              </div>
              <h3 className="pt-8 display-sm sm:pt-14 lg:pt-20">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-fog">{item.body}</p>
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}
