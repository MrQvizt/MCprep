import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardList, Mail, PackageCheck, Phone, RotateCw, ShieldAlert, Truck, XCircle } from "lucide-react";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { WhatsAppIcon } from "@/components/shared/icons";
import { Button } from "@/components/ui/button";
import { getCustomerHistorySummary, getOrderDetail } from "@/lib/admin/orders";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { formatPhone } from "@/lib/identity";
import { formatMoney } from "@/lib/money";
import {
  ELIGIBILITY_LABELS,
  ELIGIBILITY_REASON_LABELS,
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
} from "@/lib/orders/labels";
import { getSettings } from "@/lib/settings";
import { formatCalendarDate, formatDateTime } from "@/lib/time";
import { fillTemplate, whatsappLink } from "@/lib/whatsapp";
import type { OrderStatus } from "@/generated/prisma/client";
import { quickOrderStatus, retryOrderEmail } from "../actions";
import { DetailRow, EligibilityBadge, OrderStatusBadge, PaymentBadge } from "../order-ui";
import { EligibilityDecisionForm, NoteForm, PricePaymentForm, StatusForm } from "./order-forms";

export const metadata = { title: "Order" };

const EMAIL_TYPE_LABELS: Record<string, string> = {
  ORDER_BUSINESS_NOTIFICATION: "Notification to you",
  ORDER_CUSTOMER_CONFIRMATION: "Confirmation to customer",
  TEST: "Test email",
};

const EMAIL_STATUS_TONES = { SENT: "good", PENDING: "info", SENDING: "info", FAILED: "warn", DEAD: "bad" } as const;
const EMAIL_STATUS_LABELS: Record<string, string> = {
  SENT: "Sent",
  PENDING: "Queued",
  SENDING: "Sending",
  FAILED: "Failed — will retry",
  DEAD: "Failed — gave up",
};

const NEXT_STEPS: Record<OrderStatus, { status: OrderStatus; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  NEW: [
    { status: "CONTACTED", label: "Mark contacted", icon: Phone },
    { status: "CONFIRMED", label: "Mark confirmed", icon: CheckCircle2 },
  ],
  CONTACTED: [{ status: "CONFIRMED", label: "Mark confirmed", icon: CheckCircle2 }],
  CONFIRMED: [
    { status: "IN_PREPARATION", label: "In preparation", icon: ClipboardList },
    { status: "COMPLETED", label: "Mark completed", icon: PackageCheck },
  ],
  IN_PREPARATION: [{ status: "COMPLETED", label: "Mark completed", icon: PackageCheck }],
  COMPLETED: [],
  CANCELLED: [{ status: "NEW", label: "Re-open as new", icon: RotateCw }],
};

export default async function OrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin(AREA_ROLES.orders);
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();
  const settings = await getSettings();
  const tz = settings.business.timeZone;
  const history = await getCustomerHistorySummary(order);
  const anonymised = Boolean(order.customer?.anonymizedAt);

  const firstName = order.customerName.split(/\s+/)[0] || order.customerName;
  const followUp = fillTemplate(settings.contact.whatsappFollowUpMessage, {
    firstName,
    name: order.customerName,
    reference: order.reference,
    plan: order.planName,
  });
  const wa = anonymised ? null : whatsappLink(order.whatsappNumber || order.customerPhone, followUp);
  const mailto = anonymised
    ? null
    : `mailto:${order.customerEmail}?subject=${encodeURIComponent(`Your MC PREPS order request ${order.reference}`)}&body=${encodeURIComponent(`${followUp}\n\n`)}`;

  const money = (c: number | null) => (c === null ? "Price on request" : formatMoney(c, order.currency));
  const promoNeedsVerification = order.promotionAudience === "NEW_CUSTOMERS" || order.promotionAudience === "SELECTED_CUSTOMERS";
  const promoPending = order.promotionId !== null && promoNeedsVerification && order.eligibilityStatus !== "APPROVED" && order.eligibilityStatus !== "REJECTED";
  const latestReview = order.eligibilityReviews[0];
  const automatedResult = latestReview?.automatedResult ?? order.eligibilityStatus;
  const fullPrice = order.basePriceCents !== null ? order.basePriceCents + order.deliveryFeeCents : null;
  const failedEmails = order.emails.filter((e) => e.status === "FAILED" || e.status === "DEAD");

  return (
    <>
      <AdminPageHeader
        back={{ href: "/admin/orders", label: "All orders" }}
        title={`Order ${order.reference}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
            <EligibilityBadge status={order.eligibilityStatus} />
            <span>Received {formatDateTime(order.createdAt, tz)} (Malta time)</span>
          </span>
        }
        actions={
          <>
            {wa && (
              <Button asChild size="lg" className="bg-[#1fa855] text-white hover:bg-[#1a9049]">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="size-4" /> WhatsApp {firstName}
                </a>
              </Button>
            )}
            {mailto && (
              <Button asChild size="lg" variant="outline">
                <a href={mailto}>
                  <Mail className="size-4" /> Email
                </a>
              </Button>
            )}
          </>
        }
      />

      {anonymised && (
        <p className="mb-6 rounded-lg border bg-muted px-4 py-3 text-sm">
          This customer&apos;s personal data was removed on request. Pricing and status are kept for your records.
        </p>
      )}

      {/* Quick actions */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <span className="px-1 text-sm font-medium text-muted-foreground">Next step:</span>
        {NEXT_STEPS[order.status].map((step) => (
          <ActionButton key={step.status} action={quickOrderStatus.bind(null, order.id, step.status)} variant="outline" size="default">
            <step.icon className="size-4" /> {step.label}
          </ActionButton>
        ))}
        {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
          <ConfirmAction
            action={quickOrderStatus.bind(null, order.id, "CANCELLED")}
            title={`Cancel order ${order.reference}?`}
            description="The order stays in your records as cancelled. Any promotion it reserved is released. You can re-open it later."
            confirmLabel="Cancel order"
            destructive
            variant="ghost"
          >
            <XCircle className="size-4" /> Cancel order
          </ConfirmAction>
        )}
        {NEXT_STEPS[order.status].length === 0 && order.status === "COMPLETED" && (
          <span className="text-sm text-muted-foreground">This order is complete. Use the status form to change it if needed.</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <AdminCard title="Customer">
            <dl className="divide-y">
              <DetailRow label="Name">{order.customerName}</DetailRow>
              <DetailRow label="Email">
                {anonymised ? order.customerEmail : <a href={`mailto:${order.customerEmail}`} className="underline-offset-4 hover:underline">{order.customerEmail}</a>}
              </DetailRow>
              <DetailRow label="Phone">
                {anonymised ? order.customerPhone : <a href={`tel:${order.customerPhone}`} className="underline-offset-4 hover:underline">{formatPhone(order.customerPhone)}</a>}
              </DetailRow>
              <DetailRow label="WhatsApp">{order.whatsappNumber ? formatPhone(order.whatsappNumber) : null}</DetailRow>
              <DetailRow label="Marketing emails">{order.marketingOptIn ? "Opted in" : "Not opted in"}</DetailRow>
              <DetailRow label="Customer record">
                {order.customer ? (
                  <Link href={`/admin/customers/${order.customer.id}`} className="underline underline-offset-4">
                    View customer · {order.customer._count.orders} order{order.customer._count.orders === 1 ? "" : "s"}
                  </Link>
                ) : (
                  "Not linked"
                )}
              </DetailRow>
              <DetailRow label="Flags">
                {order.isReturningCustomer || order.isPotentialDuplicate ? (
                  <span className="flex flex-wrap gap-1.5">
                    {order.isReturningCustomer && <StatusBadge tone="info">Returning customer</StatusBadge>}
                    {order.isPotentialDuplicate && <StatusBadge tone="warn">Possible duplicate request</StatusBadge>}
                  </span>
                ) : null}
              </DetailRow>
            </dl>
          </AdminCard>

          <AdminCard title="Order & fulfilment">
            <dl className="divide-y">
              <DetailRow label={order.planMealsPerWeek ? "Package" : "Plan"}>
                {order.planName}
                {order.planMealsPerWeek
                  ? ` · ${order.planMealsPerWeek} meals a week · ${order.planIsSubscription ? "monthly subscription (every 4 weeks)" : "1 week"}`
                  : ` · ${order.planDurationDays} days${order.planMealsIncluded ? ` · ${order.planMealsIncluded} meals` : ""}`}
              </DetailRow>
              {order.mealSelections.length > 0 && (
                <DetailRow label="Dishes per week">
                  <ul className="space-y-0.5">
                    {order.mealSelections.map((m) => (
                      <li key={m.id}>
                        <span className="font-semibold tabular">{m.quantity}×</span> {m.mealName}
                      </li>
                    ))}
                  </ul>
                </DetailRow>
              )}
              <DetailRow label="Fulfilment">
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="size-4 text-muted-foreground" /> {FULFILLMENT_LABELS[order.fulfillmentMethod]}
                </span>
              </DetailRow>
              {order.fulfillmentMethod === "DELIVERY" ? (
                <>
                  <DetailRow label="Locality">{order.deliveryLocality}</DetailRow>
                  <DetailRow label="Address">{[order.addressLine1, order.addressLine2].filter(Boolean).join(", ") || null}</DetailRow>
                  <DetailRow label="Postcode">{order.postalCode}</DetailRow>
                </>
              ) : (
                <DetailRow label="Collection point">{order.collectionPointName ?? "To be confirmed"}</DetailRow>
              )}
              <DetailRow label="Preferred start">
                {order.preferredStartDate ? formatCalendarDate(order.preferredStartDate.toISOString().slice(0, 10)) : null}
              </DetailRow>
              <DetailRow label="Meal preference">{order.mealPreference}</DetailRow>
              <DetailRow label="Dietary preferences">{order.dietaryPreferences}</DetailRow>
              <DetailRow label="Special instructions">
                {order.specialInstructions ? <span className="whitespace-pre-line">{order.specialInstructions}</span> : null}
              </DetailRow>
              <DetailRow label="Notes from customer">{order.notes ? <span className="whitespace-pre-line">{order.notes}</span> : null}</DetailRow>
            </dl>
            {order.allergies && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldAlert className="size-4" /> Allergies / intolerances — private health information
                </p>
                <p className="mt-2 whitespace-pre-line text-sm">{order.allergies}</p>
                <p className="mt-2 text-xs text-amber-900/80">
                  Consent given {order.allergyConsentAt ? formatDateTime(order.allergyConsentAt, tz) : "—"}. Only use this to prepare the order safely.
                </p>
              </div>
            )}
          </AdminCard>

          <AdminCard title="Pricing (as quoted when submitted)" description="This snapshot never changes, even if plan prices or promotions change later.">
            <dl className="divide-y">
              <DetailRow label="Plan price">{money(order.basePriceCents)}</DetailRow>
              {order.promotionName && (
                <DetailRow label={promoPending ? "Requested discount" : "Discount"}>
                  −{formatMoney(order.discountCents, order.currency)}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({order.promotionName}
                    {order.promotionCode ? `, code ${order.promotionCode}` : ""})
                  </span>
                </DetailRow>
              )}
              {order.deliveryFeeCents > 0 && <DetailRow label="Delivery fee">{formatMoney(order.deliveryFeeCents, order.currency)}</DetailRow>}
              <DetailRow label={promoPending ? "Quoted total (if eligible)" : "Quoted total"}>
                <span className="text-base">{money(order.totalCents)}</span>
              </DetailRow>
              {order.promotionName && fullPrice !== null && order.discountCents > 0 && (
                <DetailRow label="Without promotion">{formatMoney(fullPrice, order.currency)}</DetailRow>
              )}
              {order.promotionEndsAt && <DetailRow label="Campaign ended/ends">{formatDateTime(order.promotionEndsAt, tz)}</DetailRow>}
              <DetailRow label="Agreed final price">
                {order.confirmedTotalCents !== null ? formatMoney(order.confirmedTotalCents, order.currency) : <span className="text-muted-foreground">Not set yet</span>}
              </DetailRow>
              <DetailRow label="Payment">
                <PaymentBadge status={order.paymentStatus} />
                {order.paidAmountCents !== null && <span className="ml-2">{formatMoney(order.paidAmountCents, order.currency)} received</span>}
              </DetailRow>
            </dl>
          </AdminCard>

          {order.promotionName && (
            <AdminCard
              title="Promotion eligibility"
              description={
                promoNeedsVerification
                  ? "First-order offers are checked automatically, but the final decision is yours. The customer was told their discount is subject to verification."
                  : "This promotion is open to all customers, so no eligibility check is needed."
              }
            >
              <dl className="divide-y">
                <DetailRow label="Promotion">
                  {order.promotion ? (
                    <Link href={`/admin/promotions/${order.promotion.id}`} className="underline underline-offset-4">
                      {order.promotionName}
                    </Link>
                  ) : (
                    order.promotionName
                  )}
                </DetailRow>
                <DetailRow label="Automatic check">
                  <EligibilityBadge status={automatedResult} />
                  {automatedResult === "NOT_REQUIRED" && <span>{ELIGIBILITY_LABELS.NOT_REQUIRED}</span>}
                </DetailRow>
                <DetailRow label="Why">
                  {order.eligibilityReasons.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-4 font-normal">
                      {order.eligibilityReasons.map((r) => (
                        <li key={r}>{ELIGIBILITY_REASON_LABELS[r] ?? r}</li>
                      ))}
                    </ul>
                  ) : null}
                </DetailRow>
                <DetailRow label="First-order declaration">{order.firstOrderDeclared ? "Customer confirmed this is their first order" : "Not declared"}</DetailRow>
                <DetailRow label="Customer history">
                  {history.others.length === 0 ? (
                    "No other orders found for this email, phone or customer."
                  ) : (
                    <span className="font-normal">
                      {history.others.length} other order{history.others.length === 1 ? "" : "s"} · {history.confirmed} confirmed/completed ·{" "}
                      {history.open} open · {history.withPromotion} with a promotion
                    </span>
                  )}
                </DetailRow>
                {latestReview?.decision && (
                  <DetailRow label="Decision">
                    <EligibilityBadge status={latestReview.decision} />{" "}
                    <span className="font-normal text-muted-foreground">
                      by {latestReview.decidedBy?.name ?? "an administrator"}
                      {latestReview.decidedAt ? `, ${formatDateTime(latestReview.decidedAt, tz)}` : ""}
                    </span>
                    {latestReview.note && <p className="mt-1 font-normal">“{latestReview.note}”</p>}
                  </DetailRow>
                )}
              </dl>
              {history.others.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg bg-muted/60 p-3 text-sm">
                  {history.others.slice(0, 6).map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-semibold underline-offset-4 hover:underline">
                        {o.reference}
                      </Link>
                      <OrderStatusBadge status={o.status} />
                      <span className="text-muted-foreground">
                        {o.planName}
                        {o.promotionName ? ` · ${o.promotionName}` : ""} · {formatDateTime(o.createdAt, tz, { dateStyle: "medium" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {promoNeedsVerification && (
                <div className="mt-5 border-t pt-5">
                  <EligibilityDecisionForm orderId={order.id} hasDecision={Boolean(latestReview?.decision)} />
                </div>
              )}
            </AdminCard>
          )}

          <AdminCard title="Emails" description="Automatic emails for this order. Failed emails are retried automatically.">
            {order.emails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No emails were queued for this order.</p>
            ) : (
              <ul className="divide-y">
                {order.emails.map((e) => (
                  <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{EMAIL_TYPE_LABELS[e.type] ?? e.type}</p>
                      <p className="truncate text-muted-foreground">To {e.toAddress}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.sentAt
                          ? `Sent ${formatDateTime(e.sentAt, tz)}${e.provider === "console" ? " (development log only)" : ""}`
                          : `${e.attempts} attempt${e.attempts === 1 ? "" : "s"}${e.status === "FAILED" ? ` · next try ${formatDateTime(e.nextAttemptAt, tz)}` : ""}`}
                      </p>
                      {e.lastError && e.status !== "SENT" && <p className="mt-1 break-words text-xs text-destructive">{e.lastError}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge tone={EMAIL_STATUS_TONES[e.status]}>{EMAIL_STATUS_LABELS[e.status] ?? e.status}</StatusBadge>
                      {e.status !== "SENT" && e.status !== "SENDING" && (
                        <ActionButton action={retryOrderEmail.bind(null, e.id)} variant="outline" size="sm">
                          <RotateCw className="size-3.5" /> Retry now
                        </ActionButton>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {failedEmails.length > 0 && (
              <p className="mt-3 flex items-start gap-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> If emails keep failing, check the email settings in Business settings.
              </p>
            )}
          </AdminCard>

          {(order.landingPath || order.referrerHost || order.utmSource || order.utmCampaign) && (
            <AdminCard title="Where this order came from" description="Recorded only when the visitor allowed it. Contains no personal data.">
              <dl className="divide-y">
                <DetailRow label="Landing page">{order.landingPath}</DetailRow>
                <DetailRow label="Referrer">{order.referrerHost}</DetailRow>
                <DetailRow label="Campaign source">{order.utmSource}</DetailRow>
                <DetailRow label="Medium">{order.utmMedium}</DetailRow>
                <DetailRow label="Campaign">{order.utmCampaign}</DetailRow>
              </dl>
            </AdminCard>
          )}
        </div>

        <div className="space-y-6">
          <AdminCard title="Update status">
            <StatusForm key={order.status} orderId={order.id} current={order.status} />
          </AdminCard>

          <AdminCard title="Price & payment">
            <PricePaymentForm
              key={`${order.confirmedTotalCents}-${order.paymentStatus}-${order.paidAmountCents}`}
              orderId={order.id}
              confirmedTotalCents={order.confirmedTotalCents}
              paymentStatus={order.paymentStatus}
              paidAmountCents={order.paidAmountCents}
            />
          </AdminCard>

          <AdminCard title="Internal notes">
            <NoteForm orderId={order.id} />
            {order.internalNotes.length > 0 && (
              <ul className="mt-5 space-y-3 border-t pt-4">
                {order.internalNotes.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className="whitespace-pre-line">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.author?.name ?? "Former admin"} · {formatDateTime(n.createdAt, tz)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="History">
            <ol className="relative space-y-4 border-l pl-5">
              {order.statusHistory.map((h) => (
                <li key={h.id} className="text-sm">
                  <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-ink" aria-hidden="true" />
                  <p className="font-medium">
                    {h.fromStatus === null
                      ? "Order request received"
                      : h.fromStatus !== h.toStatus
                        ? `${ORDER_STATUS_LABELS[h.fromStatus]} → ${ORDER_STATUS_LABELS[h.toStatus]}`
                        : `Note (${ORDER_STATUS_LABELS[h.toStatus]})`}
                  </p>
                  {h.note && <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{h.note}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {h.changedBy?.name ?? (h.changedById ? "Former admin" : "Website")} · {formatDateTime(h.createdAt, tz)}
                  </p>
                </li>
              ))}
              {!order.statusHistory.some((h) => h.fromStatus === null) && (
                <li className="text-sm">
                  <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-muted-foreground" aria-hidden="true" />
                  <p className="font-medium">Order request received</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Website · {formatDateTime(order.createdAt, tz)}</p>
                </li>
              )}
            </ol>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
