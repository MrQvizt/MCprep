import Link from "next/link";
import { Logo, type BrandAssetsLite } from "@/components/brand/logo";
import { CookieSettingsButton } from "@/components/analytics/consent-banner";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { FacebookIcon, GoogleIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/shared/icons";
import type { AllSettings } from "@/lib/settings/schema";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { href: "/menu", label: "Menu" },
      { href: "/plans", label: "Plans & Pricing" },
      { href: "/how-it-works", label: "How It Works" },
      { href: "/offers", label: "Offers" },
      { href: "/gallery", label: "Gallery" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Meal prep in Malta",
    links: [
      { href: "/meal-prep-malta", label: "Meal Prep Malta" },
      { href: "/healthy-meal-delivery-malta", label: "Healthy Meal Delivery" },
      { href: "/meal-plans-malta", label: "Meal Plans Malta" },
      { href: "/high-protein-meals-malta", label: "High-Protein Meals" },
      { href: "/delivery-areas", label: "Delivery Areas" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
      { href: "/order", label: "Order request" },
    ],
  },
];

export function SiteFooter({
  brand,
  settings,
  tagline,
  smallPrint,
  whatsappHref,
}: {
  brand: BrandAssetsLite;
  settings: AllSettings;
  tagline: string;
  smallPrint?: string;
  whatsappHref: string | null;
}) {
  const c = settings.contact;
  const b = settings.business;
  const year = new Date().getFullYear();
  const showAddress = b.showAddressPublicly && (b.addressLine1 || b.addressLocality);
  const socials = [
    c.instagramUrl && { href: c.instagramUrl, label: `Instagram @${c.instagramHandle}`, icon: InstagramIcon, event: "click_instagram" as const },
    c.facebookUrl && { href: c.facebookUrl, label: "Facebook", icon: FacebookIcon, event: undefined },
    c.tiktokUrl && { href: c.tiktokUrl, label: "TikTok", icon: TikTokIcon, event: undefined },
    c.googleBusinessProfileUrl && { href: c.googleBusinessProfileUrl, label: "Find us on Google", icon: GoogleIcon, event: undefined },
  ].filter(Boolean) as { href: string; label: string; icon: typeof InstagramIcon; event?: "click_instagram" }[];

  return (
    <footer className="border-t border-white/10 bg-ink text-white">
      <div className="container-site grid gap-12 py-16 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-4">
          <Link href="/" aria-label={`${brand.logoText} — home`}>
            <Logo brand={brand} />
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-fog">{tagline}</p>
          <ul className="mt-6 space-y-2 text-sm">
            {c.instagramUrl && (
              <li>
                <TrackedLink href={c.instagramUrl} event="click_instagram" className="inline-flex items-center gap-2 hover:underline underline-offset-4">
                  <InstagramIcon className="size-4" /> @{c.instagramHandle}
                </TrackedLink>
              </li>
            )}
            {whatsappHref && (
              <li>
                <TrackedLink href={whatsappHref} event="click_whatsapp" className="inline-flex items-center gap-2 hover:underline underline-offset-4">
                  <WhatsAppIcon className="size-4" /> WhatsApp us
                </TrackedLink>
              </li>
            )}
            {c.publicEmail && (
              <li>
                <TrackedLink href={`mailto:${c.publicEmail}`} event="click_email" className="hover:underline underline-offset-4">
                  {c.publicEmail}
                </TrackedLink>
              </li>
            )}
            {c.phone && (
              <li>
                <TrackedLink href={`tel:${c.phone.replace(/\s+/g, "")}`} event="click_phone" className="hover:underline underline-offset-4">
                  {c.phone}
                </TrackedLink>
              </li>
            )}
          </ul>
          {showAddress && (
            <address className="mt-4 text-sm not-italic text-fog">
              {[b.addressLine1, b.addressLine2, b.addressLocality, b.addressPostalCode, "Malta"].filter(Boolean).join(", ")}
            </address>
          )}
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-8">
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="eyebrow text-fog">{col.title}</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-white/85 transition-colors hover:text-white hover:underline underline-offset-4">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      {socials.length > 0 && (
        <div className="container-site flex flex-wrap gap-3 pb-8">
          {socials.map((s) =>
            s.event ? (
              <TrackedLink key={s.href} href={s.href} event={s.event} aria-label={s.label} className="inline-grid size-11 place-items-center border border-white/15 hover:border-white">
                <s.icon className="size-5" />
              </TrackedLink>
            ) : (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="inline-grid size-11 place-items-center border border-white/15 hover:border-white">
                <s.icon className="size-5" />
              </a>
            ),
          )}
        </div>
      )}

      <div className="border-t border-white/10">
        <div className="container-site flex flex-col gap-4 py-6 text-xs text-fog md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {b.registeredName || b.tradingName}
            {b.registeredName && b.registeredName !== b.tradingName ? ` trading as ${b.tradingName}` : ""}. Malta.
            {b.vatNumber ? ` VAT ${b.vatNumber}.` : ""}
            {smallPrint ? ` ${smallPrint}` : ""}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href="/privacy-policy" className="hover:text-white">Privacy</Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-white">Terms</Link>
            </li>
            <li>
              <Link href="/cookie-policy" className="hover:text-white">Cookies</Link>
            </li>
            <li>
              <CookieSettingsButton className="hover:text-white" />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
