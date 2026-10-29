import { WhatsAppIcon } from "@/components/shared/icons";
import { CtaLink } from "./cta-link";
import { Section } from "./section";

/** Compact closing call-to-action used at the end of inner pages. */
export function CtaBand({
  title = "Ready to fuel your week?",
  body = "Choose a plan and send your order request. No payment is taken online.",
  ctaLabel = "Choose your plan",
  ctaHref = "/plans",
  whatsappHref,
  tone = "paper",
}: {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  whatsappHref?: string | null;
  tone?: "paper" | "charcoal" | "mist";
}) {
  const dark = tone === "charcoal";
  return (
    <Section tone={tone} className="py-14 sm:py-16 lg:py-20" aria-label="Get started">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="display-lg text-balance">{title}</h2>
          <p className={dark ? "mt-4 text-fog" : "mt-4 text-smoke"}>{body}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <CtaLink href={ctaHref} variant={dark ? "primary" : "dark"} size="lg">
            {ctaLabel}
          </CtaLink>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-track="click_whatsapp"
              className="inline-flex h-14 items-center justify-center gap-3 border border-current/30 px-8 text-[0.8rem] font-semibold uppercase tracking-[0.14em] transition-colors hover:border-current"
            >
              <WhatsAppIcon className="size-5" /> WhatsApp
            </a>
          )}
        </div>
      </div>
    </Section>
  );
}
