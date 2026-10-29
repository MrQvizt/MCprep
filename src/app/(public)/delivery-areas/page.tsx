import Link from "next/link";
import { ArrowUpRight, Check, MapPin, Package, X } from "lucide-react";
import { ClickTracking } from "@/components/public/click-tracking";
import { CtaBand } from "@/components/public/cta-band";
import { PageHero } from "@/components/public/page-hero";
import { Section, TextBlock } from "@/components/public/section";
import { WhatsAppIcon } from "@/components/shared/icons";
import { getContent } from "@/lib/content";
import { formatMoney } from "@/lib/money";
import { getLocalityPageSlugs } from "@/lib/public/data";
import { groupByRegion, hasLocalityPage } from "@/lib/public/delivery";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { getCollectionPoints, getDeliveryAreas } from "@/lib/public-data";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";
import { formatWeekdays } from "@/lib/time";

export async function generateMetadata() {
  return staticPageMetadata("delivery-areas");
}

export default async function DeliveryAreasPage() {
  const [settings, content, areas, points, pageSlugs, crumb, whatsappHref] = await Promise.all([
    getSettings(),
    getContent("page.deliveryAreas"),
    getDeliveryAreas(),
    getCollectionPoints(),
    getLocalityPageSlugs(),
    crumbFor("delivery-areas"),
    getWhatsappHref("Hi MC PREPS! Do you deliver to my area?"),
  ]);
  const currency = settings.business.currency;
  const f = settings.fulfillment;
  const withPage = new Set(pageSlugs.filter(hasLocalityPage).map((p) => p.slug));
  const groups = groupByRegion(areas);
  const served = areas.filter((a) => a.deliveryAvailable);

  return (
    <>
      <ClickTracking />
      <PageHero crumbs={[crumb]} eyebrow={content.eyebrow} title={content.heading} intro={content.intro} />
      <Section tone="ink" aria-label="Delivery localities">
        {!f.deliveryEnabled ? (
          <p className="max-w-2xl text-lg text-fog">Delivery is currently paused. Collection is available — choose collection when you order.</p>
        ) : served.length === 0 ? (
          <div className="max-w-2xl border border-white/15 p-8">
            <MapPin className="size-7" aria-hidden="true" />
            <p className="mt-5 text-lg leading-relaxed text-white/85">{f.noDeliveryAreasMessage}</p>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                data-track="click_whatsapp"
                className="mt-6 inline-flex h-12 items-center gap-3 bg-white px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink hover:bg-mist"
              >
                <WhatsAppIcon className="size-5" /> Ask about your area
              </a>
            )}
          </div>
        ) : null}

        {f.deliveryEnabled && f.deliveryInfo && <TextBlock text={f.deliveryInfo} className="mb-12 max-w-3xl text-white/80" />}

        {f.deliveryEnabled &&
          groups.map((g) => (
            <section key={g.region} aria-labelledby={`region-${g.region}`} className="mt-12 first:mt-0">
              <h2 id={`region-${g.region}`} className="display-md mb-6">
                {g.label}
              </h2>
              {g.region === "GOZO" && f.gozoNote && <p className="-mt-3 mb-6 text-sm text-fog">{f.gozoNote}</p>}
              <ul className="grid border-l border-t border-white/10 sm:grid-cols-2 lg:grid-cols-3">
                {g.areas.map((a) => {
                  const facts = [
                    a.deliveryDays.length > 0 ? { k: "Days", v: formatWeekdays(a.deliveryDays) } : null,
                    a.deliveryWindow ? { k: "Time", v: a.deliveryWindow } : null,
                    a.deliveryFeeCents !== null ? { k: "Fee", v: a.deliveryFeeCents === 0 ? "Free" : formatMoney(a.deliveryFeeCents, currency) } : null,
                    a.minOrderCents !== null ? { k: "Minimum order", v: formatMoney(a.minOrderCents, currency) } : null,
                  ].filter(Boolean) as { k: string; v: string }[];
                  return (
                    <li key={a.id} className="flex flex-col border-b border-r border-white/10 bg-ink p-6">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="display-sm">{a.name}</h3>
                        {a.deliveryAvailable ? (
                          <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink">
                            <Check className="size-3" aria-hidden="true" /> Delivery
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 border border-white/25 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-fog">
                            <X className="size-3" aria-hidden="true" /> Not yet
                          </span>
                        )}
                      </div>
                      {facts.length > 0 && (
                        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                          {facts.map((fact) => (
                            <div key={fact.k} className="contents">
                              <dt className="text-fog">{fact.k}</dt>
                              <dd>{fact.v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {a.notes && <p className="mt-3 text-sm text-fog">{a.notes}</p>}
                      {withPage.has(a.slug) && (
                        <Link href={`/delivery-areas/${a.slug}`} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] underline-offset-4 hover:underline">
                          Meal prep in {a.name} <ArrowUpRight className="size-3.5" />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        {content.body && <TextBlock text={content.body} className="mt-14 max-w-3xl text-white/80" />}
      </Section>

      {f.collectionEnabled && (
        <Section tone="charcoal" aria-labelledby="collection-title">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Package className="size-7" aria-hidden="true" />
              <h2 id="collection-title" className="mt-5 display-lg">
                Prefer to collect?
              </h2>
              <p className="mt-4 text-fog">
                {f.collectionInfo || "Choose collection in the order form — we confirm collection details with you when we confirm your order."}
              </p>
            </div>
            {points.length > 0 && (
              <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
                {points.map((p) => (
                  <li key={p.id} className="border border-white/15 p-6">
                    <p className="display-sm">{p.name}</p>
                    {p.address && <p className="mt-3 text-sm text-fog">{p.address}</p>}
                    {p.availableDays.length > 0 && <p className="mt-2 text-sm">{formatWeekdays(p.availableDays)}</p>}
                    {p.timeWindows && <p className="mt-1 text-sm">{p.timeWindows}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}
      <CtaBand whatsappHref={whatsappHref} />
    </>
  );
}
