import Link from "next/link";
import { ArrowRight, Package, Truck } from "lucide-react";
import { CtaBand } from "@/components/public/cta-band";
import { PageHero } from "@/components/public/page-hero";
import { Reveal } from "@/components/public/reveal";
import { Section, TextBlock } from "@/components/public/section";
import { getContent } from "@/lib/content";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { staticPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return staticPageMetadata("how-it-works");
}

export default async function HowItWorksPage() {
  const [content, fulfillment, crumb, whatsappHref] = await Promise.all([
    getContent("page.howItWorks"),
    getContent("home.fulfillment"),
    crumbFor("how-it-works"),
    getWhatsappHref(),
  ]);
  return (
    <>
      <PageHero crumbs={[crumb]} eyebrow={content.eyebrow} title={content.heading} intro={content.intro} />
      <Section tone="paper" aria-label="Steps">
        <ol className="grid border-l border-t border-ink/10 md:grid-cols-2">
          {content.steps.map((step, i) => (
            <Reveal as="li" key={step.title} delay={(i % 2) * 80} className="flex flex-col border-b border-r border-ink/10 bg-paper p-7 sm:p-10">
              <span aria-hidden="true" className="font-display text-7xl font-black leading-none text-ink/10 tabular sm:text-8xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-8 display-md">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h2>
              <p className="mt-3 max-w-md leading-relaxed text-smoke">{step.body}</p>
            </Reveal>
          ))}
        </ol>
        {content.body && <TextBlock text={content.body} className="mt-12 max-w-3xl text-lg text-ink/80" />}
      </Section>
      <Section tone="ink" aria-labelledby="fulfilment-title">
        <h2 id="fulfilment-title" className="display-lg max-w-3xl">
          {fulfillment.heading}
        </h2>
        <p className="mt-5 max-w-2xl text-fog">{fulfillment.body}</p>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="border border-white/15 p-7">
            <Package className="size-6" aria-hidden="true" />
            <h3 className="mt-5 display-sm">{fulfillment.collectionTitle}</h3>
            <p className="mt-2 text-sm text-fog">{fulfillment.collectionBody}</p>
          </div>
          <div className="border border-white/15 p-7">
            <Truck className="size-6" aria-hidden="true" />
            <h3 className="mt-5 display-sm">{fulfillment.deliveryTitle}</h3>
            <p className="mt-2 text-sm text-fog">{fulfillment.deliveryBody}</p>
            <Link href="/delivery-areas" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] underline-offset-8 hover:underline">
              Delivery areas <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </Section>
      <CtaBand whatsappHref={whatsappHref} />
    </>
  );
}
