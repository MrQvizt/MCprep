"use client";

import { usePathname } from "next/navigation";
import { WhatsAppIcon } from "@/components/shared/icons";
import { useTrack } from "@/components/analytics/analytics-provider";
import { cn } from "@/lib/utils";

/**
 * Floating WhatsApp button. Sits above any sticky mobile CTA bar
 * (--sticky-cta-h) and respects the phone's safe area. Hidden on small screens
 * on the order page so it never covers the form.
 */
export function WhatsAppButton({ href, label = "Chat with us on WhatsApp" }: { href: string; label?: string }) {
  const pathname = usePathname();
  const track = useTrack();
  const onOrderPage = pathname.startsWith("/order");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      onClick={() => track("click_whatsapp")}
      style={{
        bottom: "calc(var(--sticky-cta-h, 0px) + max(1rem, env(safe-area-inset-bottom)))",
        right: "max(1rem, env(safe-area-inset-right))",
      }}
      className={cn(
        "group fixed z-[60] inline-flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
        onOrderPage && "hidden md:inline-flex",
      )}
    >
      <WhatsAppIcon className="size-7" />
      <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap bg-ink px-3 py-2 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 md:block">
        {label}
      </span>
    </a>
  );
}
