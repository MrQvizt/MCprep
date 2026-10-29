"use server";

import { after } from "next/server";
import { fail, ok, zodFieldErrors, type ActionState } from "@/lib/actions";
import { processOutbox } from "@/lib/email/outbox";
import { orderRequestSchema, quoteRequestSchema, type OrderRequestInput, type QuoteRequest } from "@/lib/orders/schema";
import { getOfferWindowStart } from "@/lib/offer-window-server";
import { createOrderRequest, OrderValidationError, quoteForOrder } from "@/lib/orders/service";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { verifyTurnstile } from "@/lib/turnstile";
import { toQuoteView, type QuoteView } from "./quote-view";

export type { QuoteView };

/** Live price summary for the order form. Calculated on the server only. */
export async function getQuoteAction(input: QuoteRequest): Promise<QuoteView | null> {
  const parsed = quoteRequestSchema.safeParse(input);
  if (!parsed.success) return null;
  const limited = await rateLimit(`quote:${await clientIp()}`, 120, 60);
  if (!limited.ok) return null;
  const now = new Date();
  const qc = await quoteForOrder({ ...parsed.data, now, offerWindowStartedAt: await getOfferWindowStart(now) });
  if (!qc) return null;
  return toQuoteView(qc);
}

const GENERIC_ERROR = "We couldn't send your order request. Please try again, or message us on WhatsApp.";

/** Submit an order request. Prices, discounts and eligibility are decided here, never in the browser. */
export async function submitOrderAction(input: OrderRequestInput): Promise<ActionState<{ redirectTo: string; reference: string }>> {
  const ip = await clientIp();
  const [burst, daily] = await Promise.all([rateLimit(`order:${ip}`, 6, 10 * 60), rateLimit(`order-day:${ip}`, 25, 24 * 3600)]);
  if (!burst.ok || !daily.ok) {
    return fail("Too many order requests from this connection. Please wait a few minutes or message us on WhatsApp.");
  }

  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const data = parsed.data;

  // Spam protection: honeypot, implausibly fast submissions, optional Turnstile.
  if (data.website) return fail(GENERIC_ERROR);
  if (data.elapsedMs !== undefined && data.elapsedMs < 2000) {
    return fail("That was quick! Please check your details and submit again.");
  }
  if (!(await verifyTurnstile(data.turnstileToken, ip))) {
    return fail("Please complete the spam check and try again.");
  }

  try {
    const now = new Date();
    const result = await createOrderRequest(data, { now, offerWindowStartedAt: await getOfferWindowStart(now) });
    if (result.emailIds.length > 0) {
      // Best-effort immediate delivery; failures stay queued for retry.
      after(() => processOutbox({ ids: result.emailIds }).catch((e) => console.error("[order] email send failed", e)));
    }
    return ok("Order request received", { redirectTo: result.confirmationUrl, reference: result.reference });
  } catch (error) {
    if (error instanceof OrderValidationError) return fail(error.message, error.fieldErrors);
    console.error("[order] submission failed", error);
    return fail(GENERIC_ERROR);
  }
}
