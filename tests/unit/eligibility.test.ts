import { describe, expect, it } from "vitest";
import { classifyEligibility, needsManualVerification, type CustomerHistory } from "@/lib/orders/eligibility";

function history(overrides: Partial<CustomerHistory> = {}): CustomerHistory {
  return {
    customerId: "c1",
    manualStatus: null,
    fulfilledOrders: 0,
    recentOpenOrders: 0,
    redemptionsOfPromotion: 0,
    newCustomerRedemptions: 0,
    isSelectedForPromotion: false,
    ...overrides,
  };
}

const base = { perCustomerLimit: 1 as number | null, emailMatch: null as CustomerHistory | null, phoneMatch: null as CustomerHistory | null };

describe("classifyEligibility — new-customer promotions", () => {
  it("treats unknown contacts as preliminarily eligible", () => {
    const r = classifyEligibility({ ...base, audience: "NEW_CUSTOMERS" });
    expect(r.status).toBe("PRELIMINARY_ELIGIBLE");
    expect(r.reasons).toEqual(["NO_MATCH"]);
    expect(r.linkCustomerId).toBeNull();
  });

  it("flags customers with fulfilled orders as likely ineligible", () => {
    const r = classifyEligibility({ ...base, audience: "NEW_CUSTOMERS", emailMatch: history({ fulfilledOrders: 2 }) });
    expect(r.status).toBe("LIKELY_INELIGIBLE");
    expect(r.reasons).toContain("PRIOR_CONFIRMED_ORDER");
    expect(r.isReturningCustomer).toBe(true);
  });

  it("flags prior redemptions of new-customer offers", () => {
    const r = classifyEligibility({ ...base, audience: "NEW_CUSTOMERS", phoneMatch: history({ newCustomerRedemptions: 1 }) });
    expect(r.status).toBe("LIKELY_INELIGIBLE");
    expect(r.reasons).toContain("PRIOR_REDEMPTION");
  });

  it("respects a manual 'existing customer' override", () => {
    const r = classifyEligibility({ ...base, audience: "NEW_CUSTOMERS", emailMatch: history({ manualStatus: "EXISTING" }) });
    expect(r.status).toBe("LIKELY_INELIGIBLE");
    expect(r.reasons).toContain("MANUAL_EXISTING");
  });

  it("respects a manual 'first-time customer' override", () => {
    const r = classifyEligibility({ ...base, audience: "NEW_CUSTOMERS", emailMatch: history({ manualStatus: "FIRST_TIME", fulfilledOrders: 1 }) });
    expect(r.status).toBe("PRELIMINARY_ELIGIBLE");
  });

  it("asks for review when email and phone belong to different customers", () => {
    const r = classifyEligibility({
      ...base,
      audience: "NEW_CUSTOMERS",
      emailMatch: history({ customerId: "a" }),
      phoneMatch: history({ customerId: "b" }),
    });
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.reasons).toContain("EMAIL_PHONE_DIFFERENT_CUSTOMERS");
    expect(r.linkCustomerId).toBe("a");
  });

  it("asks for review (possible duplicate) when an open request exists", () => {
    const r = classifyEligibility({ ...base, audience: "NEW_CUSTOMERS", emailMatch: history({ recentOpenOrders: 1 }) });
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.isPotentialDuplicate).toBe(true);
  });
});

describe("classifyEligibility — other audiences", () => {
  it("needs no check for all-customer promotions within the per-customer limit", () => {
    expect(classifyEligibility({ ...base, audience: "ALL_CUSTOMERS", emailMatch: history() }).status).toBe("NOT_REQUIRED");
  });

  it("flags the per-customer limit for all-customer promotions", () => {
    const r = classifyEligibility({ ...base, audience: "ALL_CUSTOMERS", emailMatch: history({ redemptionsOfPromotion: 1 }) });
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.reasons).toContain("PER_CUSTOMER_LIMIT");
  });

  it("checks the selected-customer list", () => {
    expect(classifyEligibility({ ...base, audience: "SELECTED_CUSTOMERS", emailMatch: history({ isSelectedForPromotion: true }) }).status).toBe(
      "PRELIMINARY_ELIGIBLE",
    );
    expect(classifyEligibility({ ...base, audience: "SELECTED_CUSTOMERS" }).status).toBe("NEEDS_REVIEW");
  });

  it("returns NOT_REQUIRED without a promotion but still reports returning customers", () => {
    const r = classifyEligibility({ ...base, audience: null, emailMatch: history({ fulfilledOrders: 1 }) });
    expect(r.status).toBe("NOT_REQUIRED");
    expect(r.isReturningCustomer).toBe(true);
  });
});

describe("needsManualVerification", () => {
  it("always verifies new/selected-customer discounts", () => {
    expect(needsManualVerification("NEW_CUSTOMERS", "PRELIMINARY_ELIGIBLE")).toBe(true);
    expect(needsManualVerification("SELECTED_CUSTOMERS", "PRELIMINARY_ELIGIBLE")).toBe(true);
    expect(needsManualVerification("ALL_CUSTOMERS", "NOT_REQUIRED")).toBe(false);
    expect(needsManualVerification("ALL_CUSTOMERS", "NEEDS_REVIEW")).toBe(true);
    expect(needsManualVerification(null, "NOT_REQUIRED")).toBe(false);
  });
});
