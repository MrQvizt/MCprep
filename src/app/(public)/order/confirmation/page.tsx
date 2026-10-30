import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, CheckCircle2, Clock, Lock, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { CtaLink } from "@/components/public/cta-link";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { ClaimOrderForm } from "../../account/account-forms";
import { InstagramIcon, WhatsAppIcon } from "@/components/shared/icons";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { FULFILLMENT_LABELS } from "@/lib/orders/labels";
import { verifyConfirmationToken } from "@/lib/orders/service";
import { requestNow } from "@/lib/public-data";
import { getSettings } from "@/lib/settings";
import { formatCalendarDate, formatDateTime } from "@/lib/time";
import { fillTemplate, whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: { absolute: "Order request received | MC PREPS" },
  robots: { index: false, follow: false },
};

/**
 * Customer confirmation page. Access needs the reference AND the secret token
 * from the submission (an order reference alone reveals nothing). Only
 * non-sensitive details are shown — no contact details, address or allergies.
 */
export default async function OrderConfirmationPage({ searchParams }: PageProps<"/order/confirmation">) {
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref.slice(0, 20) : null;
  const token = typeof sp.t === "string" ? sp.t : null;
  if (!ref || !token) notFound();

  const now = await requestNow();
  const order = await db.order.findUnique({
    where: { reference: ref },
    select: {
      id: true,
      reference: true,
      idempotencyKey: true,
      customerName: true,
      planName: true,
      planDurationDays: true,
      planMealsIncluded: true,
      planMealsPerWeek: true,
      planIsSubscription: true,
      mealSelections: { orderBy: { sortOrder: "asc" }, select: { mealName: true, quantity: true } },
      fulfillmentMethod: true,
      deliveryLocality: true,
      collectionPointName: true,
      preferredStartDate: true,
      currency: true,
      basePriceCents: true,
      discountCents: true,
      deliveryFeeCents: true,
      totalCents: true,
      promotionName: true,
      promotionAudience: true,
      createdAt: true,
      confirmationExpiresAt: true,
      accountId: true,
    },
  });
  if (!order || !verifyConfirmationToken(order, token)) notFound();
  if (order.confirmationExpiresAt && order.confirmationExpiresAt < now) notFound();

  const [settings, customer] = await Promise.all([getSettings(), getCurrentCustomer()]);
  const c = settings.contact;
  const claimQuery = `?ref=${encodeURIComponent(order.reference)}&t=${encodeURIComponent(token)}`;
  const firstName = order.customerName.split(/\s+/)[0] || order.customerName;
  const verification = order.promotionName !== null && order.promotionAudience !== "ALL_CUSTOMERS";
  const wa = c.whatsappEnabled
    ? whatsappLink(c.whatsappNumber, fillTemplate(c.whatsappOrderMessage, { reference: order.reference, firstName }))
    : null;
  const money = (cents: number) => formatMoney(cents, order.currency);

  return (
    <section className="container-site py-14 sm:py-20">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="inline-flex items-center gap-2 bg-white px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink">
            <Check className="size-3.5" aria-hidden="true" /> Request received
          </p>
          <h1 className="mt-6 display-xl">Thanks, {firstName}.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-fog">
            Your order request <strong className="text-white">{order.reference}</strong> is pending confirmation.{" "}
            <strong className="text-white">No payment has been taken.</strong>
          </p>

          <ol className="mt-10 space-y-6">
            {[
              { icon: Check, title: "Request sent", body: `We received your request on ${formatDateTime(order.createdAt, settings.business.timeZone)}. A confirmation email is on its way.` },
              { icon: MessageCircle, title: "We contact you", body: "Our team will get in touch to confirm availability, your start date, collection or delivery details, and payment." },
              { icon: Clock, title: "Meals prepared", body: "Once everything is confirmed, your meals are prepared fresh as agreed." },
            ].map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center border border-white/30 font-display font-black">{i + 1}</span>
                <div>
                  <p className="font-display font-black uppercase">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-fog">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-wrap gap-3">
            {wa && (
              <CtaLink href={wa} arrow={false} className="gap-2">
                <WhatsAppIcon className="size-5" /> Message us about {order.reference}
              </CtaLink>
            )}
            {c.instagramUrl && (
              <CtaLink href={c.instagramUrl} variant="outline" arrow={false} className="gap-2">
                <InstagramIcon className="size-5" /> Follow @{c.instagramHandle}
              </CtaLink>
            )}
            <CtaLink href="/" variant="ghost">
              Back to homepage
            </CtaLink>
          </div>
        </div>

        <aside className="lg:col-span-5">
          <div className="light border border-white bg-paper p-6 text-ink sm:p-8">
            <p className="eyebrow text-smoke">Your request</p>
            <p className="mt-2 font-display text-2xl font-black tracking-wide">{order.reference}</p>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-smoke">{order.planMealsPerWeek ? "Package" : "Plan"}</dt>
                <dd className="text-right font-semibold">
                  {order.planName}
                  <span className="block text-xs font-normal text-smoke">
                    {order.planMealsPerWeek
                      ? `${order.planMealsPerWeek} meals a week · ${order.planIsSubscription ? "monthly subscription" : "1 week"}`
                      : order.planMealsIncluded
                        ? `${order.planMealsIncluded} meals`
                        : null}
                  </span>
                </dd>
              </div>
              {order.mealSelections.length > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-smoke">Dishes / week</dt>
                  <dd className="text-right text-xs leading-relaxed">
                    {order.mealSelections.map((m) => (
                      <span key={m.mealName} className="block">
                        {m.quantity}× {m.mealName}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-smoke">Fulfilment</dt>
                <dd className="text-right font-semibold">
                  {FULFILLMENT_LABELS[order.fulfillmentMethod]}
                  {order.deliveryLocality ? ` · ${order.deliveryLocality}` : order.collectionPointName ? ` · ${order.collectionPointName}` : ""}
                </dd>
              </div>
              {order.preferredStartDate && (
                <div className="flex justify-between gap-4">
                  <dt className="text-smoke">Preferred start</dt>
                  <dd className="font-semibold">{formatCalendarDate(order.preferredStartDate)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
                <dt className="text-smoke">{order.planIsSubscription ? "First 4 weeks" : "Price"}</dt>
                <dd className="tabular font-semibold">{order.basePriceCents === null ? "Confirmed with you" : money(order.basePriceCents)}</dd>
              </div>
              {order.promotionName && order.discountCents > 0 && (
                <div className="flex justify-between gap-4">
                  <dt>
                    {order.promotionName}
                    {verification && <span className="block text-xs text-smoke">Requested — subject to verification</span>}
                  </dt>
                  <dd className="tabular font-semibold">−{money(order.discountCents)}</dd>
                </div>
              )}
              {order.deliveryFeeCents > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-smoke">Delivery</dt>
                  <dd className="tabular font-semibold">{money(order.deliveryFeeCents)}</dd>
                </div>
              )}
            </dl>
            <div className="mt-5 flex items-end justify-between border-t border-ink/15 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">{verification ? "Estimated total" : "Quoted total"}</p>
              <p className="font-display text-3xl font-black tabular">{order.totalCents === null ? "—" : money(order.totalCents)}</p>
            </div>
            {order.planIsSubscription && order.basePriceCents !== null && (
              <p className="mt-2 text-xs text-smoke">Then {money(order.basePriceCents)} every 4 weeks.</p>
            )}
            <p className="mt-5 flex gap-2.5 bg-mist p-3 text-sm leading-relaxed">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                No payment has been taken. {verification ? "Offer eligibility is confirmed by our team, so your final amount will be confirmed when we contact you." : "Our team will confirm your final amount and payment arrangements with you."}
              </span>
            </p>
          </div>
          <p className="mt-4 text-xs text-fog">Keep your reference handy. This page is private to you.</p>
          <AccountCard
            state={
              order.accountId
                ? customer && order.accountId === customer.id
                  ? "saved"
                  : "other"
                : customer
                  ? "claim"
                  : "signed-out"
            }
            reference={order.reference}
            token={token}
            claimQuery={claimQuery}
          />
        </aside>
      </div>
    </section>
  );
}

/** Nudge to keep the order in an account (or confirm it already is). */
function AccountCard({
  state,
  reference,
  token,
  claimQuery,
}: {
  state: "saved" | "claim" | "signed-out" | "other";
  reference: string;
  token: string;
  claimQuery: string;
}) {
  if (state === "other") return null;
  if (state === "saved") {
    return (
      <p className="mt-6 flex items-center gap-2 border border-white/15 p-4 text-sm">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
        <span>
          Saved to{" "}
          <Link href="/account" className="font-semibold underline underline-offset-4">
            your account
          </Link>
          {" "}— order it again any time.
        </span>
      </p>
    );
  }
  return (
    <div className="light mt-6 bg-paper p-6 text-ink">
      <p className="flex items-center gap-2 font-display text-lg font-black uppercase">
        <UserRound className="size-5" aria-hidden="true" /> Re-order in two taps
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        {state === "claim"
          ? "Save this order to your account to track it and order the same package again."
          : "Create a free account to track this order, keep your details filled in and order the same package again in two taps."}
      </p>
      <div className="mt-5">
        {state === "claim" ? (
          <ClaimOrderForm reference={reference} token={token} />
        ) : (
          <div className="flex flex-col gap-3">
            <Link
              href={`/account/sign-up${claimQuery}`}
              className="inline-flex h-12 items-center justify-center bg-ink px-6 text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-charcoal"
            >
              Create my account
            </Link>
            <Link href={`/account/sign-in${claimQuery}`} className="text-center text-sm text-ink/70 underline underline-offset-4 hover:text-ink">
              I already have an account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
