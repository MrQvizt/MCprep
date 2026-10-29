/**
 * First-time customer eligibility.
 *
 * The site has no customer accounts, so eligibility is a PRELIMINARY check
 * based on previous order records matched by canonical email and phone, plus
 * the customer's own declaration. Results are stored on the order for the
 * team to verify — they are never shown to the customer, so nobody can use the
 * order form to discover whether an email or phone number is known.
 */

export type AudienceValue = "ALL_CUSTOMERS" | "NEW_CUSTOMERS" | "SELECTED_CUSTOMERS";
export type EligibilityValue =
  | "NOT_REQUIRED"
  | "PRELIMINARY_ELIGIBLE"
  | "NEEDS_REVIEW"
  | "LIKELY_INELIGIBLE"
  | "APPROVED"
  | "REJECTED";

export interface CustomerHistory {
  customerId: string;
  manualStatus: "FIRST_TIME" | "EXISTING" | null;
  /** Orders that reached CONFIRMED, IN_PREPARATION or COMPLETED. */
  fulfilledOrders: number;
  /** Open requests (NEW/CONTACTED) in the last 30 days. */
  recentOpenOrders: number;
  /** Requested/approved redemptions of THIS promotion. */
  redemptionsOfPromotion: number;
  /** Requested/approved redemptions of any new-customer promotion. */
  newCustomerRedemptions: number;
  /** Is this customer on the promotion's selected-customer list? */
  isSelectedForPromotion: boolean;
}

export interface EligibilityInput {
  /** Audience of the promotion applied by the quote, or null when no promotion applies. */
  audience: AudienceValue | null;
  perCustomerLimit: number | null;
  emailMatch: CustomerHistory | null;
  phoneMatch: CustomerHistory | null;
}

export interface EligibilityResult {
  status: EligibilityValue;
  reasons: string[];
  isReturningCustomer: boolean;
  isPotentialDuplicate: boolean;
  /** Existing customer the order should be linked to (email match preferred). */
  linkCustomerId: string | null;
}

export function classifyEligibility(input: EligibilityInput): EligibilityResult {
  const { emailMatch, phoneMatch, audience } = input;
  const matches = [emailMatch, phoneMatch].filter((m): m is CustomerHistory => m !== null);
  const unique = [...new Map(matches.map((m) => [m.customerId, m])).values()];
  const reasons: string[] = [];

  if (emailMatch) reasons.push("EMAIL_MATCH");
  if (phoneMatch) reasons.push("PHONE_MATCH");
  const conflicting = Boolean(emailMatch && phoneMatch && emailMatch.customerId !== phoneMatch.customerId);
  if (conflicting) reasons.push("EMAIL_PHONE_DIFFERENT_CUSTOMERS");

  const manualExisting = unique.some((m) => m.manualStatus === "EXISTING");
  const manualFirstTime = unique.length > 0 && unique.every((m) => m.manualStatus === "FIRST_TIME");
  const fulfilled = unique.some((m) => m.fulfilledOrders > 0);
  const openRecent = unique.some((m) => m.recentOpenOrders > 0);
  const priorRedemption = unique.some((m) => m.redemptionsOfPromotion > 0);
  const priorNewCustomerRedemption = unique.some((m) => m.newCustomerRedemptions > 0);

  const isReturningCustomer = manualExisting || (fulfilled && !manualFirstTime);
  const isPotentialDuplicate = openRecent;
  const linkCustomerId = emailMatch?.customerId ?? phoneMatch?.customerId ?? null;
  const base = { isReturningCustomer, isPotentialDuplicate, linkCustomerId };

  if (audience === null) {
    return { status: "NOT_REQUIRED", reasons, ...base };
  }

  if (audience === "ALL_CUSTOMERS") {
    const limit = input.perCustomerLimit;
    const used = Math.max(0, ...unique.map((m) => m.redemptionsOfPromotion));
    if (limit !== null && limit > 0 && used >= limit) {
      return { status: "NEEDS_REVIEW", reasons: [...reasons, "PER_CUSTOMER_LIMIT"], ...base };
    }
    return { status: "NOT_REQUIRED", reasons, ...base };
  }

  if (audience === "SELECTED_CUSTOMERS") {
    const selected = unique.some((m) => m.isSelectedForPromotion);
    if (selected && !conflicting) {
      return { status: "PRELIMINARY_ELIGIBLE", reasons: [...reasons, "SELECTED_CUSTOMER_MATCH"], ...base };
    }
    return { status: "NEEDS_REVIEW", reasons: [...reasons, "NOT_SELECTED_CUSTOMER"], ...base };
  }

  // NEW_CUSTOMERS
  if (unique.length === 0) {
    return { status: "PRELIMINARY_ELIGIBLE", reasons: ["NO_MATCH"], ...base };
  }
  if (manualExisting) {
    return { status: "LIKELY_INELIGIBLE", reasons: [...reasons, "MANUAL_EXISTING"], ...base };
  }
  if (priorRedemption || priorNewCustomerRedemption) {
    return { status: "LIKELY_INELIGIBLE", reasons: [...reasons, "PRIOR_REDEMPTION"], ...base };
  }
  if (fulfilled && !manualFirstTime) {
    return { status: "LIKELY_INELIGIBLE", reasons: [...reasons, "PRIOR_CONFIRMED_ORDER"], ...base };
  }
  if (conflicting) {
    return { status: "NEEDS_REVIEW", reasons, ...base };
  }
  if (openRecent) {
    return { status: "NEEDS_REVIEW", reasons: [...reasons, "PRIOR_OPEN_ORDER"], ...base };
  }
  if (manualFirstTime) {
    return { status: "PRELIMINARY_ELIGIBLE", reasons: [...reasons, "MANUAL_FIRST_TIME"], ...base };
  }
  // Known contact details but no confirmed orders, open requests or redemptions
  // (e.g. a previous request that was cancelled).
  return { status: "PRELIMINARY_ELIGIBLE", reasons, ...base };
}

/** Whether the team must verify the discount before confirming the price. */
export function needsManualVerification(audience: AudienceValue | null, status: EligibilityValue): boolean {
  if (audience === null) return false;
  if (audience !== "ALL_CUSTOMERS") return true;
  return status === "NEEDS_REVIEW";
}
