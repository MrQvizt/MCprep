/**
 * Pure rules for campaign landing pages (/offers/[slug]).
 * Decides whether a page renders, 404s or redirects, in which mode, and
 * whether it may be indexed.
 */

export type LandingExpiredBehaviorValue = "HIDE" | "SHOW_EXPIRED_MESSAGE" | "KEEP_INFO_PAGE" | "REDIRECT_TO_OFFERS";
export type PromotionStateValue = "DRAFT" | "SCHEDULED" | "ACTIVE" | "EXPIRED" | "LIMIT_REACHED";

/**
 * live     – offer running (or page without a promotion): prices + CTAs
 * upcoming – linked offer not started yet: no discount claims, shows start time
 * expired  – offer over: short "this offer has ended" message
 * info     – offer over, informational page kept (no prices or discount claims)
 */
export type LandingMode = "live" | "upcoming" | "expired" | "info";

export type LandingResolution =
  | { kind: "not-found" }
  | { kind: "redirect"; to: string }
  | { kind: "render"; mode: LandingMode; preview: boolean; noindex: boolean };

export interface LandingInput {
  isPublished: boolean;
  noindex: boolean;
  expiredBehavior: LandingExpiredBehaviorValue;
}

export function promotionHasEnded(state: PromotionStateValue | null): boolean {
  return state === "EXPIRED" || state === "LIMIT_REACHED" || state === "DRAFT";
}

export function resolveLandingPage(
  page: LandingInput,
  promotionState: PromotionStateValue | null,
  opts: { isAdmin: boolean },
): LandingResolution {
  // "preview" = only an administrator can see what's rendered (visitors would not).
  let preview = !page.isPublished;
  if (preview && !opts.isAdmin) return { kind: "not-found" };

  let mode: LandingMode = "live";
  if (promotionState === "SCHEDULED") mode = "upcoming";
  else if (promotionHasEnded(promotionState)) {
    switch (page.expiredBehavior) {
      case "HIDE":
        if (!opts.isAdmin) return { kind: "not-found" };
        mode = "expired";
        preview = true;
        break;
      case "REDIRECT_TO_OFFERS":
        if (!opts.isAdmin) return { kind: "redirect", to: "/offers" };
        mode = "expired";
        preview = true;
        break;
      case "KEEP_INFO_PAGE":
        mode = "info";
        break;
      default:
        mode = "expired";
    }
  }

  // Previews, ended offers and upcoming teasers are never indexed; live/info pages follow the page setting.
  const noindex = page.noindex || preview || mode === "expired" || mode === "upcoming";
  return { kind: "render", mode, preview, noindex };
}

/** Build an order link carrying plan, promotion and campaign tags. */
export function orderHref(params: { plan?: string | null; promo?: string | null; utmCampaign?: string | null; utmSource?: string | null }) {
  const sp = new URLSearchParams();
  if (params.plan) sp.set("plan", params.plan);
  if (params.promo) sp.set("promo", params.promo);
  if (params.utmCampaign) sp.set("utm_campaign", params.utmCampaign);
  if (params.utmSource) sp.set("utm_source", params.utmSource);
  const q = sp.toString();
  return q ? `/order?${q}` : "/order";
}
