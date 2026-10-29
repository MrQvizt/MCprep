"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  ATTRIBUTION_STORAGE_KEY,
  CONSENT_COOKIE,
  CONSENT_VERSION,
  parseConsent,
  type AnalyticsEventName,
  type AnalyticsParams,
  type Attribution,
  type ConsentState,
} from "@/lib/analytics/events";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export interface TrackingConfig {
  firstParty: boolean;
  ga4Id: string;
  gtmId: string;
  metaPixelId: string;
  googleAdsId: string;
  consentBannerEnabled: boolean;
}

interface AnalyticsContextValue {
  config: TrackingConfig;
  consent: ConsentState | null;
  /** True when optional third-party tracking is configured (so consent is needed). */
  needsConsent: boolean;
  setConsent: (c: { analytics: boolean; marketing: boolean }) => void;
  track: (name: AnalyticsEventName, params?: AnalyticsParams) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function utmFromLocation(): Partial<Attribution> {
  const sp = new URLSearchParams(window.location.search);
  const pick = (k: string) => sp.get(k)?.slice(0, 120) || undefined;
  return {
    utmSource: pick("utm_source"),
    utmMedium: pick("utm_medium"),
    utmCampaign: pick("utm_campaign"),
    utmTerm: pick("utm_term"),
    utmContent: pick("utm_content"),
  };
}

function externalReferrerHost(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const host = new URL(document.referrer).hostname;
    return host && host !== window.location.hostname ? host : undefined;
  } catch {
    return undefined;
  }
}

/** Read stored first-touch attribution (only exists when analytics consent was given). */
export function readAttribution(): Attribution {
  const current = typeof window !== "undefined" ? utmFromLocation() : {};
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Attribution) : {};
    // Current URL parameters win (e.g. links from ads/landing pages straight to the order form).
    return { ...stored, ...Object.fromEntries(Object.entries(current).filter(([, v]) => v)) };
  } catch {
    return current;
  }
}

const CONSENT_EVENT = "mcp:consent-change";

function subscribeConsent(listener: () => void) {
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}

export function AnalyticsProvider({ config, children }: { config: TrackingConfig; children: React.ReactNode }) {
  // Consent lives in a first-party cookie; null during SSR/hydration.
  const rawConsent = useSyncExternalStore(subscribeConsent, () => readCookie(CONSENT_COOKIE), () => null);
  const consent = useMemo(() => parseConsent(rawConsent), [rawConsent]);
  const needsConsent = Boolean(config.ga4Id || config.gtmId || config.metaPixelId || config.googleAdsId);

  const setConsent = useCallback((c: { analytics: boolean; marketing: boolean }) => {
    const value: ConsentState = { ...c, v: CONSENT_VERSION, t: Date.now() };
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`;
    window.dispatchEvent(new Event(CONSENT_EVENT));
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: c.analytics ? "granted" : "denied",
        ad_storage: c.marketing ? "granted" : "denied",
        ad_user_data: c.marketing ? "granted" : "denied",
        ad_personalization: c.marketing ? "granted" : "denied",
      });
    }
    if (!c.analytics) {
      try {
        sessionStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const track = useCallback(
    (name: AnalyticsEventName, params: AnalyticsParams = {}) => {
      // 1) First-party, cookieless event (no identifiers, no personal data).
      if (config.firstParty) {
        const body = JSON.stringify({
          name,
          path: window.location.pathname,
          referrerHost: externalReferrerHost(),
          ...utmFromLocation(),
          ...params,
        });
        try {
          const blob = new Blob([body], { type: "application/json" });
          if (!navigator.sendBeacon?.("/api/events", blob)) {
            void fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
          }
        } catch {
          /* ignore */
        }
      }
      // 2) Third-party tools only after consent (they are not loaded otherwise).
      if (window.gtag && name !== "page_view") {
        window.gtag("event", name, {
          plan: params.planSlug,
          meal: params.mealSlug,
          promotion: params.promotionSlug,
        });
      }
      if (window.dataLayer && !window.gtag) {
        window.dataLayer.push({ event: name, ...params });
      }
      if (window.fbq && name === "order_request_success") window.fbq("track", "Lead");
    },
    [config.firstParty],
  );

  const value = useMemo(
    () => ({ config, consent, needsConsent, setConsent, track }),
    [config, consent, needsConsent, setConsent, track],
  );

  return (
    <AnalyticsContext.Provider value={value}>
      <PageViewTracker track={track} />
      <AttributionCapture enabled={Boolean(consent?.analytics)} />
      {children}
    </AnalyticsContext.Provider>
  );
}

function PageViewTracker({ track }: { track: AnalyticsContextValue["track"] }) {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    track("page_view");
  }, [pathname, track]);
  return null;
}

/** Stores first-touch attribution for this browser tab — only with analytics consent. */
function AttributionCapture({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    try {
      if (sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)) return;
      const data: Attribution = {
        landingPath: window.location.pathname.slice(0, 200),
        referrerHost: externalReferrerHost(),
        ...utmFromLocation(),
        firstSeenAt: new Date().toISOString(),
      };
      sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable */
    }
  }, [enabled]);
  return null;
}

const noop: AnalyticsContextValue = {
  config: { firstParty: false, ga4Id: "", gtmId: "", metaPixelId: "", googleAdsId: "", consentBannerEnabled: false },
  consent: null,
  needsConsent: false,
  setConsent: () => undefined,
  track: () => undefined,
};

export function useAnalytics(): AnalyticsContextValue {
  return useContext(AnalyticsContext) ?? noop;
}

export function useTrack() {
  return useAnalytics().track;
}
