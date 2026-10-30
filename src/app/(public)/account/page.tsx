import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, LogOut, Plus, RotateCcw, Settings } from "lucide-react";
import { CtaLink } from "@/components/public/cta-link";
import { OrderCutoffCard } from "@/components/public/order-cutoff-notice";
import { requireCustomer } from "@/lib/customer-auth";
import { getAccountOrders } from "@/lib/customer-accounts";
import { formatMoney } from "@/lib/money";
import { formatTime12, nextCutoff } from "@/lib/order-cutoff";
import { cutoffConfig } from "@/lib/order-cutoff-settings";
import {
  CUSTOMER_ORDER_STATUS_HINTS,
  CUSTOMER_ORDER_STATUS_LABELS,
  FULFILLMENT_LABELS,
  type OrderStatusValue,
} from "@/lib/orders/labels";
import { requestNow } from "@/lib/public-data";
import { getSettings } from "@/lib/settings";
import { formatCalendarDate, formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { signOutAction } from "./actions";

export const metadata: Metadata = {
  title: { absolute: "Your account | MC PREPS" },
  robots: { index: false, follow: false },
};

type AccountOrder = Awaited<ReturnType<typeof getAccountOrders>>[number];

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-amber-100 text-amber-900",
  CONTACTED: "bg-sky-100 text-sky-900",
  CONFIRMED: "bg-emerald-100 text-emerald-900",
  IN_PREPARATION: "bg-ink text-white",
  COMPLETED: "bg-mist text-ink",
  CANCELLED: "bg-red-100 text-red-900",
};

/** /order link that rebuilds the same package and dishes, or null if the package is gone. */
function reorderHref(o: AccountOrder): string | null {
  if (!o.plan || !o.plan.isActive || o.plan.archivedAt) return null;
  const q = new URLSearchParams({ plan: o.plan.slug });
  const dishes = o.mealSelections
    .filter((m) => m.meal && m.meal.isPublished && !m.meal.archivedAt)
    .map((m) => `${m.meal!.slug}:${m.quantity}`);
  // Only carry the dishes over when they still add up (the menu may have rotated).
  const sum = o.mealSelections.reduce((n, m) => n + (m.meal && m.meal.isPublished && !m.meal.archivedAt ? m.quantity : 0), 0);
  if (dishes.length && sum === o.planMealsPerWeek) q.set("dishes", dishes.join(","));
  return `/order?${q.toString()}`;
}

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const customer = await requireCustomer("/account");
  const sp = await searchParams;
  const now = await requestNow();
  const [orders, settings] = await Promise.all([getAccountOrders(customer.id), getSettings()]);
  const tz = settings.business.timeZone;
  const f = settings.fulfillment;
  const cutoff = f.weeklyCutoffEnabled ? nextCutoff(now, cutoffConfig(f), tz) : null;

  const latest = orders.find((o) => o.status !== "CANCELLED") ?? null;
  const latestHref = latest ? reorderHref(latest) : null;
  const notice = sp.reset === "1" ? "Your new password is saved." : sp.welcome === "1" ? "Your account is ready." : null;

  return (
    <div className="bg-ink">
      <section className="container-site pb-10 pt-10 sm:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-fog">Your account</p>
            <h1 className="mt-3 display-lg">Hi, {customer.firstName}</h1>
            <p className="mt-3 text-fog">
              {orders.length === 0
                ? "Your orders will show up here."
                : `${orders.length} ${orders.length === 1 ? "order" : "orders"} · member since ${formatDate(customer.createdAt, tz, { month: "long", year: "numeric" })}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/account/settings"
              className="inline-flex h-10 items-center gap-2 border border-white/25 px-4 text-[0.7rem] font-semibold uppercase tracking-[0.16em] hover:border-white"
            >
              <Settings className="size-4" aria-hidden="true" /> Settings
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-fog hover:text-white"
              >
                <LogOut className="size-4" aria-hidden="true" /> Sign out
              </button>
            </form>
          </div>
        </div>
        {notice && (
          <p role="status" className="mt-6 inline-flex items-center gap-2 bg-white px-4 py-2.5 text-sm font-medium text-ink">
            <CheckCircle2 className="size-4" aria-hidden="true" /> {notice}
          </p>
        )}
      </section>

      <section className="container-site grid gap-6 pb-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Primary action: order again (or first order) */}
        <div className="light relative overflow-hidden bg-paper text-ink">
          <div className="grid sm:grid-cols-[1fr_12rem]">
            <div className="p-6 sm:p-8">
              {latest && latestHref ? (
                <>
                  <p className="eyebrow text-smoke">Order again</p>
                  <p className="mt-2 font-display text-2xl font-black uppercase leading-tight">{latest.planName}</p>
                  {latest.mealSelections.length > 0 && (
                    <p className="mt-2 text-sm text-ink/70">
                      {latest.mealSelections.map((m) => `${m.quantity}× ${m.mealName}`).join(" · ")}
                    </p>
                  )}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <CtaLink href={latestHref} variant="dark" arrow={false} className="gap-2">
                      <RotateCcw className="size-4" aria-hidden="true" /> Order this again
                    </CtaLink>
                    <CtaLink href="/order" variant="outline" arrow={false} className="gap-2">
                      <Plus className="size-4" aria-hidden="true" /> Build a new one
                    </CtaLink>
                  </div>
                  <p className="mt-4 text-xs text-smoke">You can change the dishes before you send it.</p>
                </>
              ) : (
                <>
                  <p className="eyebrow text-smoke">{latest ? "Your next order" : "Your first order"}</p>
                  <p className="mt-2 font-display text-2xl font-black uppercase leading-tight">Build your package</p>
                  <p className="mt-2 text-sm text-ink/70">Lunch or lunch + dinner, 5 or 7 days. Pick how many of each dish you want.</p>
                  <CtaLink href="/order" variant="dark" className="mt-6">
                    Build your package
                  </CtaLink>
                </>
              )}
            </div>
            <div className="relative hidden sm:block">
              <Image src="/images/dishes/honey-sriracha-chicken-rice.webp" alt="" fill sizes="12rem" className="object-cover" />
            </div>
          </div>
        </div>
        {cutoff && (
          <OrderCutoffCard
            cutoff={cutoff.cutoff.toISOString()}
            cutoffDay={cutoff.cutoffDay}
            weekStart={cutoff.weekStart}
            timeLabel={formatTime12(f.weeklyCutoffTime)}
            serverNow={now.toISOString()}
            className="h-fit"
          />
        )}
      </section>

      <section className="container-site pb-20" aria-labelledby="orders-heading">
        <h2 id="orders-heading" className="font-display text-xl font-black uppercase tracking-wide">
          Your orders
        </h2>
        {orders.length === 0 ? (
          <div className="mt-5 border border-dashed border-white/20 p-8 text-center">
            <p className="font-semibold">No orders yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-fog">
              Ordered before you made an account? Open the link in your order confirmation email and tap{" "}
              <span className="text-white">Save to my account</span>.
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {orders.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                tz={tz}
                whatsappHref={
                  settings.contact.whatsappEnabled
                    ? whatsappLink(settings.contact.whatsappNumber, `Hi ${settings.business.tradingName}! A question about my order ${o.reference}.`)
                    : null
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OrderRow({ order: o, tz, whatsappHref }: { order: AccountOrder; tz: string; whatsappHref: string | null }) {
  const status = o.status as OrderStatusValue;
  const total = o.confirmedTotalCents ?? o.totalCents;
  const paid = o.paymentStatus === "PAID";
  const href = o.status === "CANCELLED" ? null : reorderHref(o);
  return (
    <li className="border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-black tracking-wide">{o.reference}</span>
            <span className={cn("px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em]", STATUS_STYLES[status] ?? "bg-mist text-ink")}>
              {CUSTOMER_ORDER_STATUS_LABELS[status] ?? status}
            </span>
            {o.status !== "CANCELLED" && (
              <span
                className={cn(
                  "px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em]",
                  paid ? "bg-emerald-100 text-emerald-900" : "border border-white/25 text-fog",
                )}
              >
                {paid ? "Paid" : "Not paid yet"}
              </span>
            )}
          </div>
          <p className="mt-2 font-semibold">{o.planName}</p>
          <p className="mt-1 text-sm text-fog">
            {[
              o.planMealsPerWeek ? `${o.planMealsPerWeek} meals a week${o.planIsSubscription ? " · monthly" : ""}` : null,
              FULFILLMENT_LABELS[o.fulfillmentMethod],
              o.preferredStartDate ? `Starts ${formatCalendarDate(o.preferredStartDate)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {o.mealSelections.length > 0 && (
            <p className="mt-2 text-sm text-white/80">{o.mealSelections.map((m) => `${m.quantity}× ${m.mealName}`).join(" · ")}</p>
          )}
          <p className="mt-3 text-xs text-fog">
            {CUSTOMER_ORDER_STATUS_HINTS[status]}
            {whatsappHref && o.status !== "CANCELLED" && (
              <>
                {" "}
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-4">
                  Message us about this order
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-end justify-between gap-3 border-t border-white/10 pt-4 sm:block sm:w-auto sm:border-0 sm:pt-0 sm:text-right">
          <div>
            <p className="font-display text-2xl font-black tabular">{total === null ? "—" : formatMoney(total, o.currency)}</p>
            <p className="text-xs text-fog">Ordered {formatDate(o.createdAt, tz, { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
          {href && (
            <Link
              href={href}
              className="inline-flex h-10 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] underline-offset-4 hover:underline sm:mt-2"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" /> Order again
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
