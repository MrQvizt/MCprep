import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { enqueueEmails, type EnqueueEmailInput } from "@/lib/email/outbox";
import { renderBusinessOrderEmail, renderCustomerOrderEmail, type EmailBrand, type OrderEmailData } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/env";
import { canonicalEmail, formatPhone, normalizeEmail, normalizePhone } from "@/lib/identity";
import { mealSelectionProblem, mealsPerWeek as packageMealsPerWeek, packageLabel } from "@/lib/packages";
import { computeQuote, COUPON_MESSAGES, type Quote } from "@/lib/pricing";
import { getPricingPromotions } from "@/lib/promotions";
import { getSettings, type AllSettings } from "@/lib/settings";
import { cutoffConfig } from "@/lib/order-cutoff-settings";
import { earliestStartDate, formatTime12, WEEKDAY_NAMES } from "@/lib/order-cutoff";
import { addDaysToDateString, formatCalendarDate, zonedDateString } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";
import type { Prisma } from "@/generated/prisma/client";
import { classifyEligibility, needsManualVerification, type CustomerHistory } from "./eligibility";
import type { OrderRequest } from "./schema";

export class OrderValidationError extends Error {
  constructor(
    readonly fieldErrors: Record<string, string>,
    message = "Please check the highlighted fields.",
  ) {
    super(message);
    this.name = "OrderValidationError";
  }
}

export const CONFIRMATION_TTL_DAYS = 30;
const FULFILLED_STATUSES = ["CONFIRMED", "IN_PREPARATION", "COMPLETED"] as const;
const OPEN_STATUSES = ["NEW", "CONTACTED"] as const;
const COUNTED_REDEMPTIONS = ["REQUESTED", "APPROVED"] as const;

type Tx = Prisma.TransactionClient;

// ── Confirmation link tokens ────────────────────────────────────────────────

function tokenSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.HASH_SALT;
  if (!secret) throw new Error("AUTH_SECRET must be configured");
  return secret;
}

/** Deterministic, unforgeable token for the customer's confirmation page link. */
export function confirmationToken(orderId: string, idempotencyKey: string): string {
  return createHmac("sha256", tokenSecret()).update(`order-confirmation:${orderId}:${idempotencyKey}`).digest("base64url").slice(0, 32);
}

export function verifyConfirmationToken(order: { id: string; idempotencyKey: string }, token: string | undefined | null): boolean {
  if (!token || token.length !== 32) return false;
  const expected = Buffer.from(confirmationToken(order.id, order.idempotencyKey));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function confirmationPath(order: { id: string; reference: string; idempotencyKey: string }): string {
  return `/order/confirmation?ref=${encodeURIComponent(order.reference)}&t=${confirmationToken(order.id, order.idempotencyKey)}`;
}

export function formatOrderReference(orderNumber: number): string {
  return `MCP-${String(orderNumber).padStart(6, "0")}`;
}

// ── Quotes ──────────────────────────────────────────────────────────────────

export interface QuoteContext {
  plan: {
    id: string;
    slug: string;
    name: string;
    priceCents: number | null;
    durationDays: number;
    mealsIncluded: number | null;
    mealsPerDay: number | null;
    daysPerWeek: number | null;
    isSubscription: boolean;
    /** Packages only. */
    mealsPerWeek: number | null;
  };
  deliveryArea: { id: string; name: string; deliveryFeeCents: number | null; minOrderCents: number | null } | null;
  quote: Quote;
  minOrderShortfallCents: number | null;
}

/** Server-side quote: never trusts prices or discounts from the browser. */
export async function quoteForOrder(
  opts: {
    planSlug: string;
    couponCode?: string | null;
    firstOrderDeclared?: boolean;
    fulfillmentMethod?: "COLLECTION" | "DELIVERY";
    deliveryAreaId?: string | null;
    now: Date;
    /** Start of the visitor's personal offer window (verified cookie), if any. */
    offerWindowStartedAt?: Date | null;
  },
  tx: Tx | typeof db = db,
): Promise<QuoteContext | null> {
  const row = await tx.plan.findFirst({
    where: { slug: opts.planSlug, isActive: true, archivedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      priceCents: true,
      durationDays: true,
      mealsIncluded: true,
      mealsPerDay: true,
      daysPerWeek: true,
      isSubscription: true,
    },
  });
  if (!row) return null;
  const plan = { ...row, mealsPerWeek: packageMealsPerWeek(row) };
  const deliveryArea =
    opts.fulfillmentMethod === "DELIVERY" && opts.deliveryAreaId
      ? await tx.deliveryArea.findFirst({
          where: { id: opts.deliveryAreaId, isPublished: true, deliveryAvailable: true },
          select: { id: true, name: true, deliveryFeeCents: true, minOrderCents: true },
        })
      : null;
  const promotions = await getPricingPromotions(opts.now, tx);
  const quote = computeQuote({
    plan,
    promotions,
    now: opts.now,
    couponCode: opts.couponCode,
    firstOrderDeclared: opts.firstOrderDeclared,
    deliveryFeeCents: deliveryArea?.deliveryFeeCents ?? 0,
    offerWindowStartedAt: opts.offerWindowStartedAt ?? null,
  });
  let minOrderShortfallCents: number | null = null;
  if (deliveryArea?.minOrderCents && quote.basePriceCents !== null) {
    const goods = quote.basePriceCents - quote.discountCents;
    if (goods < deliveryArea.minOrderCents) minOrderShortfallCents = deliveryArea.minOrderCents - goods;
  }
  return { plan, deliveryArea, quote, minOrderShortfallCents };
}

// ── Eligibility history ─────────────────────────────────────────────────────

async function loadHistory(tx: Tx, customerId: string, promotionId: string | null, now: Date): Promise<CustomerHistory> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [customer, fulfilled, open, promoRedemptions, newCustomerRedemptions, selected] = await Promise.all([
    tx.customer.findUnique({ where: { id: customerId }, select: { manualStatus: true } }),
    tx.order.count({ where: { customerId, status: { in: [...FULFILLED_STATUSES] } } }),
    tx.order.count({ where: { customerId, status: { in: [...OPEN_STATUSES] }, createdAt: { gte: since } } }),
    promotionId
      ? tx.promotionRedemption.count({ where: { customerId, promotionId, status: { in: [...COUNTED_REDEMPTIONS] } } })
      : Promise.resolve(0),
    tx.promotionRedemption.count({
      where: { customerId, status: { in: [...COUNTED_REDEMPTIONS] }, promotion: { audience: "NEW_CUSTOMERS" } },
    }),
    promotionId
      ? tx.promotionSelectedCustomer.count({ where: { customerId, promotionId } })
      : Promise.resolve(0),
  ]);
  return {
    customerId,
    manualStatus: customer?.manualStatus ?? null,
    fulfilledOrders: fulfilled,
    recentOpenOrders: open,
    redemptionsOfPromotion: promoRedemptions,
    newCustomerRedemptions,
    isSelectedForPromotion: selected > 0,
  };
}

// ── Emails ──────────────────────────────────────────────────────────────────

export function emailBrand(settings: AllSettings): EmailBrand {
  const c = settings.contact;
  return {
    tradingName: settings.business.tradingName,
    timeZone: settings.business.timeZone,
    publicEmail: c.publicEmail,
    phone: c.phone,
    whatsappLink: c.whatsappEnabled ? whatsappLink(c.whatsappNumber, c.whatsappDefaultMessage) : null,
    instagramUrl: c.instagramUrl,
    siteUrl: absoluteUrl("/"),
  };
}

/** Business inboxes for order notifications (falls back to the public email). */
export function notificationRecipients(settings: AllSettings): string[] {
  const list = settings.contact.orderNotificationEmails.length
    ? settings.contact.orderNotificationEmails
    : settings.contact.publicEmail
      ? [settings.contact.publicEmail]
      : [];
  return [...new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

// ── Submission ──────────────────────────────────────────────────────────────

export interface CreateOrderResult {
  orderId: string;
  reference: string;
  confirmationUrl: string;
  duplicate: boolean;
  emailIds: string[];
}

export interface CreateOrderContext {
  now?: Date;
  /** Start of the visitor's personal offer window (verified cookie), if any. */
  offerWindowStartedAt?: Date | null;
  /** Signed-in customer account placing the order (links it to their portal). */
  accountId?: string | null;
}

async function existingByKey(idempotencyKey: string): Promise<CreateOrderResult | null> {
  const existing = await db.order.findUnique({
    where: { idempotencyKey },
    select: { id: true, reference: true, idempotencyKey: true },
  });
  if (!existing) return null;
  return { orderId: existing.id, reference: existing.reference, confirmationUrl: confirmationPath(existing), duplicate: true, emailIds: [] };
}

/**
 * Validate, price and save an order request in one transaction, together with
 * its customer record, status history, promotion redemption, eligibility
 * review, consent, attribution and queued emails (outbox). Re-submitting the
 * same idempotency key returns the original order instead of a duplicate.
 */
export async function createOrderRequest(input: OrderRequest, ctx: CreateOrderContext = {}): Promise<CreateOrderResult> {
  const now = ctx.now ?? new Date();

  const replay = await existingByKey(input.idempotencyKey);
  if (replay) return replay;

  const settings = await getSettings();
  const errors: Record<string, string> = {};

  // Contact details
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!phone) errors.phone = "Enter a valid phone number, e.g. 7912 3456 or +356 7912 3456.";
  const whatsapp = input.whatsappNumber ? normalizePhone(input.whatsappNumber) : null;
  if (input.whatsappNumber && !whatsapp) errors.whatsappNumber = "Enter a valid WhatsApp number.";

  // Fulfilment
  const f = settings.fulfillment;
  if (input.fulfillmentMethod === "DELIVERY" && !f.deliveryEnabled) errors.fulfillmentMethod = "Delivery isn't available at the moment.";
  if (input.fulfillmentMethod === "COLLECTION" && !f.collectionEnabled) errors.fulfillmentMethod = "Collection isn't available at the moment.";

  let collectionPoint: { id: string; name: string } | null = null;
  if (input.fulfillmentMethod === "COLLECTION") {
    const points = await db.collectionPoint.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    if (input.collectionPointId) {
      collectionPoint = points.find((p) => p.id === input.collectionPointId) ?? null;
      if (!collectionPoint) errors.collectionPointId = "Choose an available collection point.";
    } else if (points.length === 1) {
      collectionPoint = points[0];
    } else if (points.length > 1) {
      errors.collectionPointId = "Choose a collection point.";
    }
  }

  // Preferred start date (Malta calendar)
  if (input.preferredStartDate) {
    const today = zonedDateString(now, settings.business.timeZone);
    const earliest = earliestStartDate(now, cutoffConfig(f), f.leadTimeDays, settings.business.timeZone);
    const latest = addDaysToDateString(today, 365);
    if (input.preferredStartDate < earliest) {
      errors.preferredStartDate = f.weeklyCutoffEnabled
        ? `The earliest start is ${formatCalendarDate(earliest)} — orders for a week close the ${WEEKDAY_NAMES[f.weeklyCutoffDay]} before at ${formatTime12(f.weeklyCutoffTime)}.`
        : "Please choose a later start date.";
    }
    else if (input.preferredStartDate > latest) errors.preferredStartDate = "Please choose a date within the next year.";
  }

  // Meal preference must be one the business offers
  const options = settings.orderForm.mealPreferenceOptions;
  if (input.mealPreference && options.length > 0 && !options.includes(input.mealPreference)) {
    errors.mealPreference = "Choose one of the listed options.";
  }

  if (Object.keys(errors).length > 0) throw new OrderValidationError(errors);

  const brand = emailBrand(settings);
  const canonical = canonicalEmail(email);
  const identityValues = [
    { type: "EMAIL" as const, value: canonical },
    { type: "PHONE" as const, value: phone! },
    ...(whatsapp && whatsapp !== phone ? [{ type: "PHONE" as const, value: whatsapp }] : []),
  ];

  let created: { order: { id: string; reference: string; idempotencyKey: string }; emailIds: string[] };
  try {
    created = await db.$transaction(
      async (tx) => {
        // Serialise redemptions for promotions with a total limit.
        await tx.$queryRaw`SELECT "id" FROM "Promotion"
          WHERE "isEnabled" = true AND "totalRedemptionLimit" IS NOT NULL AND "endsAt" > ${now} FOR UPDATE`;

        const qc = await quoteForOrder(
          {
            planSlug: input.planSlug,
            couponCode: input.couponCode,
            firstOrderDeclared: input.firstOrderDeclared,
            fulfillmentMethod: input.fulfillmentMethod,
            deliveryAreaId: input.deliveryAreaId,
            now,
            offerWindowStartedAt: ctx.offerWindowStartedAt ?? null,
          },
          tx,
        );
        if (!qc) throw new OrderValidationError({ planSlug: "This plan is no longer available. Please choose another." });

        // Packages: the dish choices must add up to the package's meals per week.
        let selections: { mealId: string; mealName: string; quantity: number }[] = [];
        if (qc.plan.mealsPerWeek) {
          const menu = await tx.meal.findMany({
            where: { isPublished: true, archivedAt: null },
            select: { id: true, name: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          });
          const choices = input.mealSelections.filter((c) => c.quantity > 0);
          const problem = mealSelectionProblem(
            choices,
            qc.plan.mealsPerWeek,
            menu.map((m) => m.id),
          );
          if (problem) throw new OrderValidationError({ mealSelections: problem });
          const byId = new Map(menu.map((m) => [m.id, m.name]));
          selections = menu
            .map((m) => ({ meal: m, choice: choices.find((c) => c.mealId === m.id) }))
            .filter((x) => x.choice)
            .map((x) => ({ mealId: x.meal.id, mealName: byId.get(x.meal.id)!, quantity: x.choice!.quantity }));
        }
        if (input.fulfillmentMethod === "DELIVERY" && !qc.deliveryArea) {
          throw new OrderValidationError({ deliveryAreaId: "We don't currently deliver to that locality. Choose another or select collection." });
        }
        const { quote, plan, deliveryArea } = qc;
        if (input.couponCode && !["APPLIED", "NOT_BETTER"].includes(quote.couponStatus)) {
          throw new OrderValidationError({ couponCode: COUPON_MESSAGES[quote.couponStatus] || "This code isn't valid." });
        }
        if (qc.minOrderShortfallCents !== null) {
          throw new OrderValidationError({
            deliveryAreaId: "This plan is below the minimum order for delivery to your locality. Choose a larger plan or collection.",
          });
        }

        const fullPlan = await tx.plan.findUniqueOrThrow({
          where: { id: plan.id },
          select: { durationDays: true, mealsIncluded: true },
        });
        const promotion = quote.promotion
          ? await tx.promotion.findUniqueOrThrow({
              where: { id: quote.promotion.id },
              select: { id: true, audience: true, perCustomerLimit: true },
            })
          : null;

        // Identity matching (results are stored, never shown to the customer).
        const identities = await tx.customerIdentity.findMany({
          where: { OR: identityValues.map((i) => ({ type: i.type, value: i.value })) },
          select: { customerId: true, type: true, value: true },
        });
        const emailCustomerId = identities.find((i) => i.type === "EMAIL")?.customerId ?? null;
        const phoneCustomerId = identities.find((i) => i.type === "PHONE")?.customerId ?? null;
        const [emailMatch, phoneMatch] = await Promise.all([
          emailCustomerId ? loadHistory(tx, emailCustomerId, promotion?.id ?? null, now) : null,
          phoneCustomerId ? loadHistory(tx, phoneCustomerId, promotion?.id ?? null, now) : null,
        ]);
        const eligibility = classifyEligibility({
          audience: promotion?.audience ?? null,
          perCustomerLimit: promotion?.perCustomerLimit ?? null,
          emailMatch,
          phoneMatch,
        });
        const requiresVerification = needsManualVerification(promotion?.audience ?? null, eligibility.status);

        // Customer record (link to the matched customer or create a new one).
        let customerId = eligibility.linkCustomerId;
        if (!customerId) {
          const customer = await tx.customer.create({
            data: { name: input.fullName, email, phone, firstOrderAt: now, lastOrderAt: now },
          });
          customerId = customer.id;
        } else {
          await tx.customer.update({
            where: { id: customerId },
            data: { name: input.fullName, email, phone, lastOrderAt: now },
          });
          await tx.customer.updateMany({ where: { id: customerId, firstOrderAt: null }, data: { firstOrderAt: now } });
        }
        // Identities owned by another customer are skipped (unique constraint).
        await tx.customerIdentity.createMany({
          data: identityValues.map((i) => ({ ...i, customerId: customerId! })),
          skipDuplicates: true,
        });

        // Human-readable reference from the order sequence.
        const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`
          SELECT nextval(pg_get_serial_sequence('"Order"', 'orderNumber'))`;
        const orderNumber = Number(nextval);
        const reference = formatOrderReference(orderNumber);
        const a = input.attribution ?? {};

        const order = await tx.order.create({
          data: {
            orderNumber,
            reference,
            idempotencyKey: input.idempotencyKey,
            status: "NEW",
            paymentStatus: "NOT_COLLECTED",
            customerId,
            customerName: input.fullName,
            customerEmail: email,
            customerPhone: phone!,
            whatsappNumber: whatsapp,
            fulfillmentMethod: input.fulfillmentMethod,
            deliveryAreaId: deliveryArea?.id ?? null,
            deliveryLocality: deliveryArea?.name ?? null,
            addressLine1: input.fulfillmentMethod === "DELIVERY" ? input.addressLine1 ?? null : null,
            addressLine2: input.fulfillmentMethod === "DELIVERY" ? input.addressLine2 ?? null : null,
            postalCode: input.fulfillmentMethod === "DELIVERY" ? input.postalCode ?? null : null,
            collectionPointId: collectionPoint?.id ?? null,
            collectionPointName: collectionPoint?.name ?? null,
            preferredStartDate: input.preferredStartDate ? new Date(`${input.preferredStartDate}T00:00:00Z`) : null,
            mealPreference: input.mealPreference ?? null,
            dietaryPreferences: input.dietaryPreferences ?? null,
            allergies: input.allergies ?? null,
            specialInstructions: input.specialInstructions ?? null,
            notes: input.notes ?? null,
            planId: plan.id,
            planName: plan.name,
            planDurationDays: fullPlan.durationDays,
            planMealsIncluded: fullPlan.mealsIncluded,
            planMealsPerWeek: plan.mealsPerWeek,
            planIsSubscription: plan.isSubscription,
            accountId: ctx.accountId ?? null,
            mealSelections: selections.length
              ? { create: selections.map((sel, i) => ({ ...sel, sortOrder: i })) }
              : undefined,
            currency: settings.business.currency || "EUR",
            basePriceCents: quote.basePriceCents,
            deliveryFeeCents: quote.deliveryFeeCents,
            discountCents: quote.discountCents,
            totalCents: quote.totalCents,
            promotionId: quote.promotion?.id ?? null,
            promotionName: quote.promotion?.name ?? null,
            promotionCode: quote.promotion?.code ?? null,
            promotionDiscountType: quote.promotion?.discountType ?? null,
            promotionDiscountValue: quote.promotion?.discountValue ?? null,
            promotionEndsAt: quote.promotion?.endsAt ?? null,
            promotionAudience: quote.promotion?.audience ?? null,
            eligibilityStatus: eligibility.status,
            eligibilityReasons: eligibility.reasons,
            isReturningCustomer: eligibility.isReturningCustomer,
            isPotentialDuplicate: eligibility.isPotentialDuplicate,
            privacyAcknowledgedAt: now,
            allergyConsentAt: input.allergies && input.allergyConsent ? now : null,
            firstOrderDeclared: input.firstOrderDeclared,
            marketingOptIn: input.marketingOptIn && settings.orderForm.marketingOptInEnabled,
            landingPath: a.landingPath ?? null,
            referrerHost: a.referrerHost ?? null,
            utmSource: a.utmSource ?? null,
            utmMedium: a.utmMedium ?? null,
            utmCampaign: a.utmCampaign ?? null,
            utmTerm: a.utmTerm ?? null,
            utmContent: a.utmContent ?? null,
            confirmationExpiresAt: new Date(now.getTime() + CONFIRMATION_TTL_DAYS * 86_400_000),
            createdAt: now,
          },
        });
        const token = confirmationToken(order.id, order.idempotencyKey);
        await tx.order.update({
          where: { id: order.id },
          data: { confirmationTokenHash: createHash("sha256").update(token).digest("hex") },
        });

        await tx.orderStatusHistory.create({
          data: { orderId: order.id, fromStatus: null, toStatus: "NEW", note: "Order request submitted on the website", createdAt: now },
        });

        if (quote.promotion) {
          await tx.promotionRedemption.create({
            data: {
              promotionId: quote.promotion.id,
              orderId: order.id,
              customerId,
              status: "REQUESTED",
              discountCents: quote.discountCents,
            },
          });
          if (requiresVerification) {
            await tx.promotionEligibilityReview.create({
              data: {
                orderId: order.id,
                promotionId: quote.promotion.id,
                automatedResult: eligibility.status,
                reasons: eligibility.reasons,
              },
            });
          }
        }

        if (input.marketingOptIn && settings.orderForm.marketingOptInEnabled) {
          const unsubscribeToken = randomBytes(24).toString("base64url");
          await tx.marketingConsent.create({
            data: {
              customerId,
              orderId: order.id,
              email,
              channel: "EMAIL",
              status: "GRANTED",
              source: "order_form",
              consentText: settings.orderForm.marketingConsentText,
              unsubscribeTokenHash: createHash("sha256").update(unsubscribeToken).digest("hex"),
              grantedAt: now,
            },
          });
        }

        if (Object.values(a).some(Boolean)) {
          await tx.trackingAttribution.create({
            data: {
              orderId: order.id,
              landingPath: a.landingPath ?? null,
              referrerHost: a.referrerHost ?? null,
              utmSource: a.utmSource ?? null,
              utmMedium: a.utmMedium ?? null,
              utmCampaign: a.utmCampaign ?? null,
              utmTerm: a.utmTerm ?? null,
              utmContent: a.utmContent ?? null,
              promotionSlug: quote.promotion?.slug ?? null,
              firstSeenAt: a.firstSeenAt && !Number.isNaN(Date.parse(a.firstSeenAt)) ? new Date(a.firstSeenAt) : null,
            },
          });
        }

        // Queue emails in the same transaction (outbox): a saved order always has its notifications recorded.
        const emailData: OrderEmailData = {
          reference,
          createdAt: now,
          customerName: input.fullName,
          customerEmail: email,
          customerPhone: formatPhone(phone),
          whatsappNumber: whatsapp ? formatPhone(whatsapp) : null,
          planName: plan.name,
          planDurationDays: fullPlan.durationDays,
          planMealsIncluded: fullPlan.mealsIncluded,
          packageLabel: packageLabel(plan) || null,
          planIsSubscription: plan.isSubscription,
          planMealsPerWeek: plan.mealsPerWeek,
          mealSelections: selections.map((sel) => ({ name: sel.mealName, quantity: sel.quantity })),
          currency: order.currency,
          basePriceCents: quote.basePriceCents,
          deliveryFeeCents: quote.deliveryFeeCents,
          discountCents: quote.discountCents,
          totalCents: quote.totalCents,
          promotionName: quote.promotion?.name ?? null,
          promotionCode: quote.promotion?.code ?? null,
          promotionEndsAt: quote.promotion?.endsAt ?? null,
          promotionRequiresVerification: requiresVerification,
          eligibilityStatus: eligibility.status,
          eligibilityReasons: eligibility.reasons,
          isReturningCustomer: eligibility.isReturningCustomer,
          isPotentialDuplicate: eligibility.isPotentialDuplicate,
          fulfillmentMethod: input.fulfillmentMethod,
          deliveryLocality: deliveryArea?.name ?? null,
          addressLine1: order.addressLine1,
          addressLine2: order.addressLine2,
          postalCode: order.postalCode,
          collectionPointName: collectionPoint?.name ?? null,
          preferredStartDate: input.preferredStartDate ?? null,
          mealPreference: input.mealPreference ?? null,
          dietaryPreferences: input.dietaryPreferences ?? null,
          allergies: input.allergies ?? null,
          specialInstructions: input.specialInstructions ?? null,
          notes: input.notes ?? null,
          marketingOptIn: order.marketingOptIn,
        };
        const emails: EnqueueEmailInput[] = [];
        const business = renderBusinessOrderEmail(emailData, brand, absoluteUrl(`/admin/orders/${order.id}`));
        for (const to of notificationRecipients(settings)) {
          emails.push({
            type: "ORDER_BUSINESS_NOTIFICATION",
            dedupeKey: `order:${order.id}:business:${to}`,
            to,
            replyTo: email,
            ...business,
            orderId: order.id,
          });
        }
        if (settings.orderForm.sendCustomerConfirmation) {
          const customerEmail = renderCustomerOrderEmail(emailData, brand);
          emails.push({
            type: "ORDER_CUSTOMER_CONFIRMATION",
            dedupeKey: `order:${order.id}:customer`,
            to: email,
            replyTo: settings.contact.replyToEmail || settings.contact.publicEmail || null,
            ...customerEmail,
            orderId: order.id,
          });
        }
        await enqueueEmails(tx, emails);
        const queued = await tx.emailOutbox.findMany({ where: { orderId: order.id }, select: { id: true } });

        return { order: { id: order.id, reference, idempotencyKey: order.idempotencyKey }, emailIds: queued.map((e) => e.id) };
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (error) {
    // A concurrent duplicate submission with the same key won the race.
    if ((error as { code?: string }).code === "P2002") {
      const existing = await existingByKey(input.idempotencyKey);
      if (existing) return existing;
    }
    throw error;
  }

  return {
    orderId: created.order.id,
    reference: created.order.reference,
    confirmationUrl: confirmationPath(created.order),
    duplicate: false,
    emailIds: created.emailIds,
  };
}
