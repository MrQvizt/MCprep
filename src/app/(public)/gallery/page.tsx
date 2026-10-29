import { ClickTracking } from "@/components/public/click-tracking";
import { GalleryGrid } from "@/components/public/gallery-grid";
import { PageHero } from "@/components/public/page-hero";
import { Section } from "@/components/public/section";
import { InstagramIcon } from "@/components/shared/icons";
import { getContent } from "@/lib/content";
import { crumbFor } from "@/lib/public/page";
import { getGalleryItems } from "@/lib/public-data";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";
import { isInstagramUrl } from "@/lib/urls";

export async function generateMetadata() {
  return staticPageMetadata("gallery");
}

export default async function GalleryPage() {
  const [settings, content, items, crumb] = await Promise.all([getSettings(), getContent("page.gallery"), getGalleryItems(), crumbFor("gallery")]);
  const insta = isInstagramUrl(settings.contact.instagramUrl) ? settings.contact.instagramUrl : null;
  const follow = insta ? (
    <a
      href={insta}
      target="_blank"
      rel="noopener noreferrer"
      data-track="click_instagram"
      className="inline-flex h-12 items-center gap-3 bg-white px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink hover:bg-mist"
    >
      <InstagramIcon className="size-5" /> Follow @{settings.contact.instagramHandle}
    </a>
  ) : null;
  return (
    <>
      <ClickTracking />
      <PageHero crumbs={[crumb]} eyebrow={content.eyebrow} title={content.heading} intro={content.intro}>
        {follow}
      </PageHero>
      <Section tone="ink" aria-label="Photos" className="pt-10 sm:pt-12">
        {items.length === 0 ? (
          <p className="text-fog">New photos are coming soon. In the meantime, find us on Instagram.</p>
        ) : (
          <GalleryGrid items={items} profileUrl={insta} columns="wide" />
        )}
      </Section>
    </>
  );
}
