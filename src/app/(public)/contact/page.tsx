import { Clock, Mail, MapPin, MessageCircle, Phone, Star } from "lucide-react";
import { ClickTracking } from "@/components/public/click-tracking";
import { CtaLink } from "@/components/public/cta-link";
import { PageHero } from "@/components/public/page-hero";
import { Section } from "@/components/public/section";
import { GoogleIcon, InstagramIcon, WhatsAppIcon } from "@/components/shared/icons";
import { JsonLd } from "@/components/shared/json-ld";
import { getContent } from "@/lib/content";
import { getJsonLdContext, getLocalBusinessExtras } from "@/lib/public/data";
import { crumbFor } from "@/lib/public/page";
import { getCollectionPoints } from "@/lib/public-data";
import { localBusinessJsonLd } from "@/lib/seo/jsonld";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";
import { formatWeekdays } from "@/lib/time";
import { isInstagramUrl, isSafeHttpUrl } from "@/lib/urls";
import { whatsappLink } from "@/lib/whatsapp";
import type { AnalyticsEventName } from "@/lib/analytics/events";

export async function generateMetadata() {
  return staticPageMetadata("contact");
}

interface Channel {
  key: string;
  label: string;
  value: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  event?: AnalyticsEventName;
  note?: string;
}

export default async function ContactPage() {
  const [settings, content, crumb, points, ctx, extras] = await Promise.all([
    getSettings(),
    getContent("page.contact"),
    crumbFor("contact"),
    getCollectionPoints(),
    getJsonLdContext(),
    getLocalBusinessExtras(),
  ]);
  const c = settings.contact;
  const handle = c.instagramHandle.replace(/^@/, "");
  const wa = whatsappLink(c.whatsappNumber, c.whatsappDefaultMessage);
  const channels: Channel[] = [];
  if (wa) channels.push({ key: "wa", label: "WhatsApp", value: c.whatsappNumber, href: wa, icon: WhatsAppIcon, event: "click_whatsapp", note: "Fastest way to reach us" });
  if (isInstagramUrl(c.instagramUrl))
    channels.push({ key: "ig", label: "Instagram", value: `@${handle}`, href: c.instagramUrl, icon: InstagramIcon, event: "click_instagram" });
  if (c.instagramDmEnabled && handle)
    channels.push({ key: "dm", label: "Instagram DM", value: "Send us a message", href: `https://ig.me/m/${encodeURIComponent(handle)}`, icon: MessageCircle, event: "click_instagram" });
  if (c.publicEmail) channels.push({ key: "mail", label: "Email", value: c.publicEmail, href: `mailto:${c.publicEmail}`, icon: Mail, event: "click_email" });
  if (c.phone) channels.push({ key: "tel", label: "Phone", value: c.phone, href: `tel:${c.phone.replace(/\s+/g, "")}`, icon: Phone, event: "click_phone" });
  if (isSafeHttpUrl(c.googleBusinessProfileUrl))
    channels.push({ key: "gbp", label: "Google", value: "Find us on Google", href: c.googleBusinessProfileUrl, icon: GoogleIcon });
  if (isSafeHttpUrl(c.googleReviewUrl))
    channels.push({ key: "review", label: "Reviews", value: "Review us on Google", href: c.googleReviewUrl, icon: Star });

  const b = settings.business;
  const showAddress = b.showAddressPublicly && (b.addressLine1 || b.addressLocality);

  return (
    <>
      <JsonLd data={localBusinessJsonLd({ ...ctx, areas: extras.servedAreas, plans: extras.catalog, currency: b.currency })} />
      <ClickTracking />
      <PageHero crumbs={[crumb]} eyebrow={content.eyebrow} title={content.heading} intro={content.intro} />
      <Section tone="ink" aria-label="Ways to reach us">
        <ul className="grid border-l border-t border-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((ch) => (
            <li key={ch.key} className="border-b border-r border-white/10 bg-ink">
              <a
                href={ch.href}
                {...(ch.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                data-track={ch.event}
                className="group flex h-full flex-col p-7 transition-colors hover:bg-charcoal sm:p-8"
              >
                <ch.icon className="size-7" />
                <span className="eyebrow mt-10 text-fog">{ch.label}</span>
                <span className="mt-2 break-words font-display text-xl font-extrabold uppercase leading-tight group-hover:underline underline-offset-4">
                  {ch.value}
                </span>
                {ch.note && <span className="mt-2 text-xs text-fog">{ch.note}</span>}
              </a>
            </li>
          ))}
        </ul>
        {c.supportHours && (
          <p className="mt-8 flex items-center gap-3 text-sm text-fog">
            <Clock className="size-4" aria-hidden="true" /> {c.supportHours}
          </p>
        )}
        {showAddress && (
          <address className="mt-4 flex items-start gap-3 text-sm not-italic text-fog">
            <MapPin className="mt-0.5 size-4" aria-hidden="true" />
            {[b.addressLine1, b.addressLine2, b.addressLocality, b.addressPostalCode, "Malta"].filter(Boolean).join(", ")}
          </address>
        )}
      </Section>
      {points.length > 0 && (
        <Section tone="charcoal" aria-labelledby="collection-title">
          <h2 id="collection-title" className="display-lg">
            Collection
          </h2>
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {points.map((p) => (
              <li key={p.id} className="border border-white/15 p-7">
                <p className="display-sm">{p.name}</p>
                {p.address && <p className="mt-3 text-sm text-fog">{p.address}</p>}
                {p.availableDays.length > 0 && <p className="mt-2 text-sm">{formatWeekdays(p.availableDays)}</p>}
                {p.timeWindows && <p className="mt-1 text-sm">{p.timeWindows}</p>}
                {p.instructions && <p className="mt-3 text-sm text-fog">{p.instructions}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section tone="paper" aria-labelledby="order-title" className="py-14 sm:py-16 lg:py-20">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="order-title" className="display-lg">
              Ready to order?
            </h2>
            <p className="mt-3 max-w-xl text-smoke">Choose a plan and send your request online — we&apos;ll contact you to confirm everything.</p>
          </div>
          <CtaLink href="/plans" variant="dark" size="lg">
            Choose your plan
          </CtaLink>
        </div>
      </Section>
    </>
  );
}
