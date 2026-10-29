import { z } from "zod";

/**
 * Order request schema — shared by the client form (React Hook Form) and the
 * server action. The server performs additional checks (phone parsing, plan and
 * locality availability, Malta-time date limits, pricing, eligibility).
 */

const optionalText = (max: number, message?: string) =>
  z
    .string()
    .trim()
    .max(max, message ?? `Please keep this under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const MALTA_POSTCODE_RE = /^[A-Za-z]{3}\s?\d{2,4}$/;
const PHONE_LOOSE_RE = /^\+?[\d\s().-]{7,20}$/;

export const attributionSchema = z
  .object({
    landingPath: z.string().max(200).optional(),
    referrerHost: z.string().max(200).optional(),
    utmSource: z.string().max(120).optional(),
    utmMedium: z.string().max(120).optional(),
    utmCampaign: z.string().max(120).optional(),
    utmTerm: z.string().max(120).optional(),
    utmContent: z.string().max(120).optional(),
    firstSeenAt: z.string().max(40).optional(),
  })
  .partial()
  .optional();

export const orderFieldsSchema = z.object({
    idempotencyKey: z.string().uuid("Please refresh the page and try again."),
    planSlug: z.string().min(1, "Choose a plan."),
    fullName: z.string().trim().min(2, "Enter your full name.").max(120, "That name is too long."),
    email: z.string().trim().email("Enter a valid email address.").max(200),
    phone: z.string().trim().regex(PHONE_LOOSE_RE, "Enter a valid phone number, e.g. 7912 3456."),
    whatsappNumber: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => !v || PHONE_LOOSE_RE.test(v), "Enter a valid WhatsApp number."),
    fulfillmentMethod: z.enum(["COLLECTION", "DELIVERY"], { message: "Choose collection or delivery." }),
    deliveryAreaId: optionalText(60),
    addressLine1: optionalText(160),
    addressLine2: optionalText(160),
    postalCode: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.toUpperCase() : undefined))
      .refine((v) => !v || MALTA_POSTCODE_RE.test(v), "Use the Maltese postcode format, e.g. SLM 1234."),
    collectionPointId: optionalText(60),
    preferredStartDate: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Choose a valid date."),
    mealPreference: optionalText(80),
    dietaryPreferences: optionalText(1000),
    allergies: optionalText(1000),
    specialInstructions: optionalText(1000),
    notes: optionalText(1500),
    couponCode: optionalText(40),
    firstOrderDeclared: z.boolean().default(false),
    privacyAccepted: z.literal(true, { message: "Please confirm you've read the privacy notice." }),
    allergyConsent: z.boolean().default(false),
    marketingOptIn: z.boolean().default(false),
    /** Honeypot — must stay empty (hidden from people). */
    website: z.string().max(0).optional().or(z.literal("")),
    /** Milliseconds the form was open before submitting (spam heuristic). */
    elapsedMs: z.number().int().nonnegative().optional(),
    turnstileToken: z.string().max(4096).optional(),
    attribution: attributionSchema,
});

type RefineInput = {
  fulfillmentMethod: "COLLECTION" | "DELIVERY";
  deliveryAreaId?: string;
  addressLine1?: string;
  allergies?: string;
  allergyConsent: boolean;
};

function refineOrder(v: RefineInput, ctx: z.RefinementCtx) {
    if (v.fulfillmentMethod === "DELIVERY") {
      if (!v.deliveryAreaId) ctx.addIssue({ code: "custom", path: ["deliveryAreaId"], message: "Choose your locality." });
      if (!v.addressLine1) ctx.addIssue({ code: "custom", path: ["addressLine1"], message: "Enter your delivery address." });
    }
    if (v.allergies && !v.allergyConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["allergyConsent"],
        message: "Please allow us to use your allergy information to prepare your order safely.",
      });
    }
}

export const orderRequestSchema = orderFieldsSchema.superRefine(refineOrder);

/** Client form schema (system fields are added at submit time). */
export const orderFormSchema = orderFieldsSchema
  .omit({ idempotencyKey: true, elapsedMs: true, turnstileToken: true, attribution: true })
  .superRefine(refineOrder);

export type OrderFormInput = z.input<typeof orderFormSchema>;
export type OrderFormValues = z.output<typeof orderFormSchema>;

export type OrderRequestInput = z.input<typeof orderRequestSchema>;
export type OrderRequest = z.output<typeof orderRequestSchema>;

export const quoteRequestSchema = z.object({
  planSlug: z.string().min(1).max(80),
  couponCode: z.string().trim().max(40).optional(),
  firstOrderDeclared: z.boolean().default(false),
  fulfillmentMethod: z.enum(["COLLECTION", "DELIVERY"]).optional(),
  deliveryAreaId: z.string().max(60).optional(),
});

export type QuoteRequest = z.input<typeof quoteRequestSchema>;

export const FIRST_ORDER_DECLARATION = (brand: string) =>
  `I confirm this is my first order with ${brand} and understand that the promotional discount is subject to verification.`;
