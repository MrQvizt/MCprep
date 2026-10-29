/** Client-safe display labels for order-related enums. */

export const ORDER_STATUSES = ["NEW", "CONTACTED", "CONFIRMED", "IN_PREPARATION", "COMPLETED", "CANCELLED"] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONFIRMED: "Confirmed",
  IN_PREPARATION: "In preparation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_HINTS: Record<OrderStatusValue, string> = {
  NEW: "Just received — contact the customer.",
  CONTACTED: "You've reached out; waiting to confirm details.",
  CONFIRMED: "Details and price agreed with the customer.",
  IN_PREPARATION: "Meals are being prepared.",
  COMPLETED: "Delivered or collected.",
  CANCELLED: "Will not go ahead.",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  NOT_COLLECTED: "Payment not collected",
  PENDING: "Payment pending",
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
  FAILED: "Payment failed",
};

export const FULFILLMENT_LABELS: Record<string, string> = {
  COLLECTION: "Collection",
  DELIVERY: "Delivery",
};

export const ELIGIBILITY_LABELS: Record<string, string> = {
  NOT_REQUIRED: "No first-order check needed",
  PRELIMINARY_ELIGIBLE: "New customer (preliminary)",
  NEEDS_REVIEW: "Eligibility pending review",
  LIKELY_INELIGIBLE: "Returning customer — likely not eligible",
  APPROVED: "Promotion approved (manual)",
  REJECTED: "Promotion rejected (manual)",
};

export const ELIGIBILITY_TONES: Record<string, "neutral" | "good" | "warn" | "bad"> = {
  NOT_REQUIRED: "neutral",
  PRELIMINARY_ELIGIBLE: "good",
  NEEDS_REVIEW: "warn",
  LIKELY_INELIGIBLE: "bad",
  APPROVED: "good",
  REJECTED: "bad",
};

export const ELIGIBILITY_REASON_LABELS: Record<string, string> = {
  NO_MATCH: "No previous orders found for this email or phone.",
  EMAIL_MATCH: "The email matches a previous customer.",
  PHONE_MATCH: "The phone number matches a previous customer.",
  EMAIL_PHONE_DIFFERENT_CUSTOMERS: "Email and phone match two different customer records.",
  PRIOR_CONFIRMED_ORDER: "This customer has a previous confirmed or completed order.",
  PRIOR_OPEN_ORDER: "This customer has another open order request.",
  PRIOR_REDEMPTION: "This customer already requested or used this promotion.",
  PER_CUSTOMER_LIMIT: "This customer has reached the promotion's per-customer limit.",
  MANUAL_EXISTING: "Marked as an existing customer by an administrator.",
  MANUAL_FIRST_TIME: "Marked as a first-time customer by an administrator.",
  SELECTED_CUSTOMER_MATCH: "Customer is on the promotion's selected-customer list.",
  NOT_SELECTED_CUSTOMER: "Customer is not on the promotion's selected-customer list.",
};

export const DISCOUNT_STATE_LABELS = {
  APPLIED: "Promotion applied",
  PENDING: "Promotion pending verification",
  REJECTED: "Promotion rejected",
  OVERRIDE: "Manual override",
} as const;
