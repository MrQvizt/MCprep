"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useHydrated } from "@/hooks/use-hydrated";
import { useAnalytics } from "./analytics-provider";

/**
 * Cookie consent banner. Only shown when optional third-party tools (GA4, GTM,
 * Meta Pixel, Google Ads) are configured — the site's own statistics are
 * cookieless. Rejecting is as easy as accepting.
 */
export function ConsentBanner() {
  const { config, consent, needsConsent, setConsent } = useAnalytics();
  const [open, setOpen] = useState(false);
  const [customise, setCustomise] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const ready = useHydrated();

  useEffect(() => {
    const handler = () => {
      setAnalytics(Boolean(consent?.analytics));
      setMarketing(Boolean(consent?.marketing));
      setCustomise(true);
      setOpen(true);
    };
    window.addEventListener("mcp:open-consent", handler);
    return () => window.removeEventListener("mcp:open-consent", handler);
  }, [consent]);

  const shouldShow = ready && config.consentBannerEnabled && needsConsent && (open || consent === null);
  if (!shouldShow) return null;

  const save = (c: { analytics: boolean; marketing: boolean }) => {
    setConsent(c);
    setOpen(false);
    setCustomise(false);
  };
  const hasMarketingTools = Boolean(config.metaPixelId || config.googleAdsId);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl border border-white/15 bg-charcoal p-5 text-white shadow-2xl sm:bottom-5 safe-bottom"
    >
      <h2 id="consent-title" className="font-display text-sm font-extrabold uppercase tracking-[0.14em]">
        Your privacy
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-fog">
        We use essential cookies to run this site and count visits without cookies. With your permission we&apos;d also
        like to use optional analytics{hasMarketingTools ? " and marketing" : ""} cookies to understand what works.{" "}
        <Link href="/cookie-policy" className="underline underline-offset-4 hover:text-white">
          Cookie policy
        </Link>
      </p>
      {customise && (
        <fieldset className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm">
          <legend className="sr-only">Cookie preferences</legend>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked disabled className="mt-1 size-4 accent-white" />
            <span>
              <strong className="font-semibold">Essential</strong> — always on. Remembers your choice and keeps the site secure.
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              className="mt-1 size-4 accent-white"
            />
            <span>
              <strong className="font-semibold">Analytics</strong> — Google Analytics, to see which pages are useful.
            </span>
          </label>
          {hasMarketingTools && (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1 size-4 accent-white"
              />
              <span>
                <strong className="font-semibold">Marketing</strong> — measures whether our ads lead to order requests.
              </span>
            </label>
          )}
        </fieldset>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {customise ? (
          <button
            type="button"
            onClick={() => save({ analytics, marketing })}
            className="h-11 flex-1 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink hover:bg-mist"
          >
            Save choices
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCustomise(true)}
            className="h-11 flex-1 border border-white/30 px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
          >
            Customise
          </button>
        )}
        <button
          type="button"
          onClick={() => save({ analytics: false, marketing: false })}
          className="h-11 flex-1 border border-white/30 px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white"
        >
          Reject optional
        </button>
        <button
          type="button"
          onClick={() => save({ analytics: true, marketing: true })}
          className="h-11 flex-1 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink hover:bg-mist"
        >
          Accept all
        </button>
      </div>
    </div>
  );
}

export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("mcp:open-consent"))}>
      Cookie settings
    </button>
  );
}
