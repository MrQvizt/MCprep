import { getContent, type ContentKey } from "@/lib/content";
import { crumbFor } from "@/lib/public/page";
import type { StaticPageKey } from "@/lib/seo/pages";
import { getSettings } from "@/lib/settings";
import { PageHero } from "./page-hero";
import { RichText } from "./rich-text";
import { Section } from "./section";

type LegalKey = Extract<ContentKey, `legal.${string}`>;

export async function LegalPage({ contentKey, pageKey, showBusinessDetails = false }: { contentKey: LegalKey; pageKey: StaticPageKey; showBusinessDetails?: boolean }) {
  const [content, crumb, settings] = await Promise.all([getContent(contentKey), crumbFor(pageKey), getSettings()]);
  const b = settings.business;
  const c = settings.contact;
  const showAddress = b.showAddressPublicly && (b.addressLine1 || b.addressLocality);
  const details = [
    { k: "Trading name", v: b.tradingName },
    b.registeredName ? { k: "Registered name", v: b.registeredName } : null,
    b.registrationNumber ? { k: "Company registration", v: b.registrationNumber } : null,
    b.vatNumber ? { k: "VAT number", v: b.vatNumber } : null,
    showAddress ? { k: "Address", v: [b.addressLine1, b.addressLine2, b.addressLocality, b.addressPostalCode, "Malta"].filter(Boolean).join(", ") } : null,
    c.publicEmail ? { k: "Contact email", v: c.publicEmail } : null,
    c.phone ? { k: "Phone", v: c.phone } : null,
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <>
      <PageHero crumbs={[crumb]} title={content.title} size="lg">
        {content.lastUpdated && <p className="text-xs uppercase tracking-[0.14em] text-fog">Last updated {content.lastUpdated}</p>}
      </PageHero>
      <Section tone="paper" aria-label={content.title}>
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_16rem]">
          <RichText html={content.html} className="text-ink/85" />
          {showBusinessDetails && details.length > 0 && (
            <aside aria-label="Business details" className="h-fit border-t-2 border-ink pt-5 text-sm lg:sticky lg:top-28">
              <p className="eyebrow mb-4 text-smoke">Who we are</p>
              <dl className="space-y-3">
                {details.map((d) => (
                  <div key={d.k}>
                    <dt className="text-xs text-smoke">{d.k}</dt>
                    <dd className="font-medium">{d.v}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          )}
        </div>
      </Section>
    </>
  );
}
