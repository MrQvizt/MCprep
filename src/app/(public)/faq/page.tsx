import { CtaBand } from "@/components/public/cta-band";
import { FaqList } from "@/components/public/faq-list";
import { PageHero } from "@/components/public/page-hero";
import { Section } from "@/components/public/section";
import { JsonLd } from "@/components/shared/json-ld";
import { getContent } from "@/lib/content";
import { crumbFor, getWhatsappHref } from "@/lib/public/page";
import { getPublishedFaqs } from "@/lib/public-data";
import { faqJsonLd } from "@/lib/seo/jsonld";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { slugify } from "@/lib/urls";

export async function generateMetadata() {
  return staticPageMetadata("faq");
}

export default async function FaqPage() {
  const [content, faqs, crumb, whatsappHref] = await Promise.all([
    getContent("page.faq"),
    getPublishedFaqs(),
    crumbFor("faq"),
    getWhatsappHref(),
  ]);
  const groups = new Map<string, typeof faqs>();
  for (const f of faqs) {
    const key = f.category?.trim() || "General";
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const grouped = [...groups.entries()];
  return (
    <>
      <JsonLd data={faqJsonLd(faqs.map((f) => ({ question: f.question, answer: f.answer })))} />
      <PageHero crumbs={[crumb]} eyebrow={content.eyebrow} title={content.heading} intro={content.intro} />
      <Section tone="ink" aria-label="Questions">
        {faqs.length === 0 ? (
          <p className="text-fog">No questions published yet — message us and we&apos;ll gladly help.</p>
        ) : (
          <div className="grid gap-12 lg:grid-cols-12">
            {grouped.length > 1 && (
              <nav aria-label="FAQ topics" className="lg:col-span-3">
                <ul className="flex flex-wrap gap-2 lg:sticky lg:top-28 lg:flex-col lg:gap-3">
                  {grouped.map(([cat, items]) => (
                    <li key={cat}>
                      <a
                        href={`#${slugify(cat)}`}
                        className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] hover:border-white lg:border-0 lg:px-0 lg:py-0 lg:hover:underline lg:underline-offset-4"
                      >
                        {cat} <span className="text-fog tabular">{items.length}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <div className={grouped.length > 1 ? "space-y-16 lg:col-span-9" : "lg:col-span-12"}>
              {grouped.map(([cat, items]) => (
                <section key={cat} id={slugify(cat)} aria-labelledby={`faq-${slugify(cat)}`} className="scroll-mt-28">
                  <h2 id={`faq-${slugify(cat)}`} className="display-md mb-4">
                    {cat}
                  </h2>
                  <FaqList items={items} />
                </section>
              ))}
            </div>
          </div>
        )}
      </Section>
      <CtaBand
        title="Still have a question?"
        body="Message us on WhatsApp or Instagram — we're happy to help with plans, allergies and delivery."
        ctaLabel="Contact us"
        ctaHref="/contact"
        whatsappHref={whatsappHref}
      />
    </>
  );
}
