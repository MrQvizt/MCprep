import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { CtaBand } from "@/components/public/cta-band";
import { CtaLink } from "@/components/public/cta-link";
import { PageHero } from "@/components/public/page-hero";
import { Section, TextBlock } from "@/components/public/section";
import { formatMoney } from "@/lib/money";
import { getLocality } from "@/lib/public/data";
import { hasLocalityPage, REGION_LABELS } from "@/lib/public/delivery";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { buildMetadata, titleWithSuffix } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";
import { formatWeekdays } from "@/lib/time";

async function load(slug: string) {
  const area = await getLocality(slug);
  return area && hasLocalityPage(area) ? area : null;
}

export async function generateMetadata({ params }: PageProps<"/delivery-areas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const area = await load(slug);
  if (!area) return { title: "Area not found", robots: { index: false } };
  return buildMetadata({
    title: await titleWithSuffix(`Meal Prep Delivery in ${area.name}`),
    description: (area.pageIntro || `MC PREPS meal prep delivery and collection options for ${area.name}, Malta.`).slice(0, 160),
    path: `/delivery-areas/${area.slug}`,
  });
}

export default async function LocalityPage({ params }: PageProps<"/delivery-areas/[slug]">) {
  const { slug } = await params;
  const area = await load(slug);
  if (!area) notFound();
  const [settings, parent, whatsappHref] = await Promise.all([getSettings(), crumbFor("delivery-areas"), getWhatsappHref()]);
  const currency = settings.business.currency;
  const facts = [
    { k: "Delivery", v: area.deliveryAvailable ? "Available" : "Not currently available — collection only" },
    area.deliveryDays.length > 0 ? { k: "Delivery days", v: formatWeekdays(area.deliveryDays) } : null,
    area.deliveryWindow ? { k: "Delivery time", v: area.deliveryWindow } : null,
    area.deliveryFeeCents !== null ? { k: "Delivery fee", v: area.deliveryFeeCents === 0 ? "Free" : formatMoney(area.deliveryFeeCents, currency) } : null,
    area.minOrderCents !== null ? { k: "Minimum order", v: formatMoney(area.minOrderCents, currency) } : null,
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <>
      <PageHero
        crumbs={[parent, { name: area.name, path: `/delivery-areas/${area.slug}` }]}
        eyebrow={`${REGION_LABELS[area.region]} · Delivery area`}
        title={`Meal prep in ${area.name}`}
        intro={area.pageIntro}
      >
        <CtaLink href="/plans" size="lg">
          Choose your plan
        </CtaLink>
      </PageHero>
      <Section tone="paper" aria-label={`Delivery in ${area.name}`}>
        <div className="grid gap-12 lg:grid-cols-12">
          <dl className="space-y-4 border-t-2 border-ink pt-6 lg:col-span-4">
            {facts.map((f) => (
              <div key={f.k}>
                <dt className="eyebrow text-smoke">{f.k}</dt>
                <dd className="mt-1 flex items-center gap-2 font-semibold">
                  {f.k === "Delivery" && area.deliveryAvailable && <Check className="size-4" aria-hidden="true" />}
                  {f.v}
                </dd>
              </div>
            ))}
            {area.notes && <p className="text-sm text-smoke">{area.notes}</p>}
          </dl>
          <div className="lg:col-span-8">
            <TextBlock text={area.pageBody} className="max-w-2xl text-lg leading-relaxed text-ink/80" />
          </div>
        </div>
      </Section>
      <CtaBand whatsappHref={whatsappHref} />
    </>
  );
}
