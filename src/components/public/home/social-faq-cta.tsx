import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "@/components/shared/icons";
import { MediaImage } from "@/components/shared/media-image";
import type { ContentOf } from "@/lib/content/schema";
import type { getPublishedTestimonials } from "@/lib/public-data";
import { isSafeHref } from "@/lib/urls";
import { CtaLink } from "../cta-link";
import { FaqList, type FaqItem } from "../faq-list";
import { GalleryGrid, type GalleryTile } from "../gallery-grid";
import { Reveal } from "../reveal";
import { Section } from "../section";

export function HomeInstagram({
  content,
  items,
  instagramUrl,
  handle,
}: {
  content: ContentOf<"home.instagram">;
  items: GalleryTile[];
  instagramUrl: string | null;
  handle: string;
}) {
  if (items.length === 0 && !instagramUrl) return null;
  return (
    <Section tone="paper" aria-labelledby="instagram-title" className="pb-0 sm:pb-0 lg:pb-0">
      <div className="flex flex-col gap-8 pb-12 md:flex-row md:items-end md:justify-between lg:pb-16">
        <div>
          <p className="eyebrow mb-4 flex items-center gap-2 text-smoke">
            <InstagramIcon className="size-4" /> {content.eyebrow}
          </p>
          <h2 id="instagram-title" className="display-xl">
            {content.heading}
          </h2>
          {handle && (
            <p className="mt-4 font-display text-xl font-bold">
              {instagramUrl ? (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" data-track="click_instagram" className="hover:underline underline-offset-4">
                  @{handle}
                </a>
              ) : (
                <>@{handle}</>
              )}
            </p>
          )}
        </div>
        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-track="click_instagram"
            className="inline-flex h-14 shrink-0 items-center justify-center gap-3 self-start whitespace-nowrap bg-ink px-8 text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-charcoal md:self-end"
          >
            <InstagramIcon className="size-5" />
            {content.ctaLabel}
          </a>
        )}
      </div>
      <GalleryGrid items={items} profileUrl={instagramUrl} />
    </Section>
  );
}

type Testimonials = Awaited<ReturnType<typeof getPublishedTestimonials>>;

export function HomeTestimonials({ content, items }: { content: ContentOf<"home.testimonials">; items: Testimonials }) {
  if (items.length === 0) return null;
  return (
    <Section tone="mist" aria-labelledby="testimonials-title">
      <p className="eyebrow mb-4 text-smoke">{content.eyebrow}</p>
      <h2 id="testimonials-title" className="display-lg">
        {content.heading}
      </h2>
      <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t, i) => (
          <Reveal as="li" key={t.id} delay={(i % 3) * 80}>
            <figure className="flex h-full flex-col border border-ink/10 bg-paper p-7">
              <Quote className="size-6 text-ink/30" aria-hidden="true" />
              <blockquote className="mt-4 flex-1 text-base leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-ink/10 pt-5">
                {t.photo && <MediaImage media={t.photo} alt="" className="size-10 shrink-0 rounded-full" sizes="40px" />}
                <span>
                  <span className="block text-sm font-semibold">{t.displayName}</span>
                  {t.context && <span className="block text-xs text-smoke">{t.context}</span>}
                </span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

export function HomeFaq({ content, faqs, whatsappHref }: { content: ContentOf<"home.faq">; faqs: FaqItem[]; whatsappHref: string | null }) {
  if (faqs.length === 0) return null;
  return (
    <Section tone="ink" aria-labelledby="faq-title">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="eyebrow mb-4 text-fog">{content.eyebrow}</p>
          <h2 id="faq-title" className="display-lg text-balance">
            {content.heading}
          </h2>
          <div className="mt-8 flex flex-col items-start gap-4 text-xs font-semibold uppercase tracking-[0.16em]">
            <Link href="/faq" className="inline-flex items-center gap-2 underline-offset-8 hover:underline">
              All questions <ArrowRight className="size-4" />
            </Link>
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" data-track="click_whatsapp" className="inline-flex items-center gap-2 underline-offset-8 hover:underline">
                <WhatsAppIcon className="size-4" /> Ask us on WhatsApp
              </a>
            )}
          </div>
        </div>
        <FaqList items={faqs} className="lg:col-span-8" />
      </div>
    </Section>
  );
}

export function HomeFinalCta({ content, whatsappHref }: { content: ContentOf<"home.finalCta">; whatsappHref: string | null }) {
  const cta = isSafeHref(content.cta.href) ? content.cta : { label: "Build your package", href: "/order" };
  return (
    <Section tone="paper" aria-labelledby="final-cta-title" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 right-0 select-none font-display text-[28vw] font-black uppercase leading-none tracking-tighter text-ink/[0.04] lg:text-[22vw]"
      >
        MC
      </div>
      <div className="relative max-w-5xl">
        <h2 id="final-cta-title" className="display-2xl text-balance">
          {content.headline}
        </h2>
        {content.body && <p className="mt-7 max-w-xl text-lg text-smoke sm:text-xl">{content.body}</p>}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <CtaLink href={cta.href} variant="dark" size="lg">
            {cta.label}
          </CtaLink>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-track="click_whatsapp"
              className="inline-flex h-14 items-center justify-center gap-3 border border-ink/30 px-8 text-[0.8rem] font-semibold uppercase tracking-[0.14em] transition-colors hover:border-ink"
            >
              <WhatsAppIcon className="size-5" /> Message us
            </a>
          )}
        </div>
      </div>
    </Section>
  );
}
