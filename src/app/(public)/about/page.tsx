import { InstagramIcon } from "@/components/shared/icons";
import { MediaImage } from "@/components/shared/media-image";
import { CtaBand } from "@/components/public/cta-band";
import { PageHero } from "@/components/public/page-hero";
import { Reveal } from "@/components/public/reveal";
import { Section, TextBlock } from "@/components/public/section";
import { getContent } from "@/lib/content";
import { getMedia } from "@/lib/media";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";
import { isInstagramUrl } from "@/lib/urls";

export async function generateMetadata() {
  return staticPageMetadata("about");
}

export default async function AboutPage() {
  const [content, settings, crumb, whatsappHref] = await Promise.all([
    getContent("page.about"),
    getSettings(),
    crumbFor("about"),
    getWhatsappHref(),
  ]);
  const image = await getMedia(content.imageId);
  const insta = isInstagramUrl(settings.contact.instagramUrl) ? settings.contact.instagramUrl : null;
  return (
    <>
      <PageHero crumbs={[crumb]} eyebrow={content.eyebrow} title={content.heading} intro={content.intro} />
      <Section tone="paper" aria-label="Our story">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <MediaImage media={image} alt={image?.altText ?? "MC PREPS"} sizes="(min-width:1024px) 40vw, 100vw" className="aspect-[4/5] w-full" placeholderLabel="MC PREPS kitchen — photo coming soon" />
          </div>
          <div className="lg:col-span-7 lg:pt-6">
            <TextBlock text={content.body} className="text-lg leading-relaxed text-ink/80 sm:text-xl [&>p:first-child]:text-ink" />
            {insta && (
              <a
                href={insta}
                target="_blank"
                rel="noopener noreferrer"
                data-track="click_instagram"
                className="mt-10 inline-flex items-center gap-3 border-b-2 border-ink pb-1 text-sm font-semibold uppercase tracking-[0.14em]"
              >
                <InstagramIcon className="size-5" /> @{settings.contact.instagramHandle}
              </a>
            )}
          </div>
        </div>
      </Section>
      {content.values.length > 0 && (
        <Section tone="ink" aria-labelledby="values-title">
          <h2 id="values-title" className="display-lg">
            What we stand for
          </h2>
          <ul className="mt-12 grid border-l border-t border-white/10 md:grid-cols-3">
            {content.values.map((v, i) => (
              <Reveal as="li" key={v.title} delay={i * 80} className="border-b border-r border-white/10 bg-ink p-7 sm:p-9">
                <span className="font-display text-sm font-bold text-white/40 tabular">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-10 display-sm">{v.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-fog">{v.body}</p>
              </Reveal>
            ))}
          </ul>
        </Section>
      )}
      <CtaBand whatsappHref={whatsappHref} />
    </>
  );
}
