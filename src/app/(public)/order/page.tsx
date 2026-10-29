import { Breadcrumbs } from "@/components/public/breadcrumbs";
import Link from "next/link";
import { CtaLink } from "@/components/public/cta-link";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { env } from "@/lib/env";
import { getOfferWindowStart } from "@/lib/offer-window-server";
import { earliestStartDate, formatTime12, nextCutoff } from "@/lib/order-cutoff";
import { cutoffConfig } from "@/lib/order-cutoff-settings";
import { FIRST_ORDER_DECLARATION } from "@/lib/orders/schema";
import { quoteForOrder } from "@/lib/orders/service";
import { evenSplit, isPackage, type MealChoice } from "@/lib/packages";
import { getLivePublicPromotions } from "@/lib/promotions";
import { getCollectionPoints, getDeliveryAreas, getPublicPlans, getPublishedMeals, requestNow } from "@/lib/public-data";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";
import { addDaysToDateString, zonedDateString } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";
import { OrderForm, type OrderFormProps } from "./order-form";
import { toQuoteView } from "./quote-view";

export async function generateMetadata() {
  return staticPageMetadata("order");
}

function str(v: string | string[] | undefined, max = 80): string | undefined {
  return typeof v === "string" ? v.slice(0, max) : undefined;
}

/** "?dishes=chicken-pokebowl:4,mexican-beef-bowl:6" → dish choices (unknown dishes ignored). */
function parseDishes(raw: string | undefined, dishes: { id: string; slug: string }[]): MealChoice[] {
  if (!raw) return [];
  const out: MealChoice[] = [];
  for (const part of raw.split(",").slice(0, 20)) {
    const [slug, qty] = part.split(":");
    const dish = dishes.find((d) => d.slug === slug);
    const quantity = Number(qty);
    if (dish && Number.isInteger(quantity) && quantity > 0 && quantity <= 60 && !out.some((c) => c.mealId === dish.id)) {
      out.push({ mealId: dish.id, quantity });
    }
  }
  return out;
}

export default async function OrderPage({ searchParams }: PageProps<"/order">) {
  const sp = await searchParams;
  const now = await requestNow();
  const [settings, plans, meals, areas, points, windowStart, customer] = await Promise.all([
    getSettings(),
    getPublicPlans(),
    getPublishedMeals(),
    getDeliveryAreas(),
    getCollectionPoints(),
    getOfferWindowStart(now),
    getCurrentCustomer(),
  ]);
  const currency = settings.business.currency || "EUR";
  const promos = await getLivePublicPromotions(now, currency).catch(() => []);
  const brandName = settings.business.tradingName;
  const c = settings.contact;
  const wa = whatsappLink(c.whatsappNumber, c.whatsappDefaultMessage);

  if (plans.length === 0) {
    return (
      <section className="container-site py-24">
        <h1 className="display-lg">Order requests are paused</h1>
        <p className="mt-4 max-w-xl text-fog">Our packages are being updated. Message us and we&apos;ll help you directly.</p>
        {wa && (
          <CtaLink href={wa} className="mt-8">
            Message us on WhatsApp
          </CtaLink>
        )}
      </section>
    );
  }

  const packages = plans.filter(isPackage);
  const requested = str(sp.plan);
  const defaultPlan =
    plans.find((p) => p.slug === requested) ??
    packages.find((p) => p.isRecommended) ??
    packages[0] ??
    plans.find((p) => p.isRecommended) ??
    plans[0];
  const coupon = str(sp.code)?.toUpperCase();

  const dishes = meals.map((m) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    imageUrl: m.image?.url ?? null,
    imageAlt: m.image?.altText ?? m.name,
    calories: m.calories,
    proteinG: m.proteinG,
    carbsG: m.carbsG,
    fatG: m.fatG,
    label: m.label,
  }));
  let initialSelections = parseDishes(str(sp.dishes, 400), dishes);
  if (initialSelections.length === 0 && defaultPlan.mealsPerWeek) {
    initialSelections = evenSplit(
      dishes.map((d) => d.id),
      defaultPlan.mealsPerWeek,
    );
  }

  const qc = await quoteForOrder({ planSlug: defaultPlan.slug, couponCode: coupon, now, offerWindowStartedAt: windowStart });
  // Live offer with a personal deadline ("order within 2 hours"), if any.
  const personal = promos.filter((p) => p.personalWindowMinutes).sort((a, b) => (a.endsAt < b.endsAt ? -1 : 1))[0] ?? null;
  const intro = personal
    ? {
        name: personal.name,
        headline: personal.headline,
        discountType: personal.discountType,
        discountValue: personal.discountValue,
        label: personal.discountLabel,
        windowMinutes: personal.personalWindowMinutes!,
        endsAt: personal.endsAt,
        startedAt: windowStart?.toISOString() ?? null,
        terms: personal.terms,
        newCustomersOnly: personal.audience === "NEW_CUSTOMERS",
      }
    : null;

  const today = zonedDateString(now, settings.business.timeZone);
  const tz = settings.business.timeZone;
  const f = settings.fulfillment;
  const cutoff = f.weeklyCutoffEnabled ? nextCutoff(now, cutoffConfig(f), tz) : null;
  const toOption = (p: (typeof plans)[number]) => ({
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    durationDays: p.durationDays,
    mealsIncluded: p.mealsIncluded,
    priceCents: p.priceCents,
    isRecommended: p.isRecommended,
    savingsLabel: p.savingsLabel,
    mealsPerDay: p.mealsPerDay,
    daysPerWeek: p.daysPerWeek,
    isSubscription: p.isSubscription,
    mealsPerWeek: p.mealsPerWeek,
    perMealCents: p.perMealCents,
    offerPriceCents: p.offer?.priceCents ?? null,
    offerFirstOrderOnly: p.offer?.firstOrderOnly ?? false,
  });
  const props: OrderFormProps = {
    brandName,
    currency,
    serverNow: now.toISOString(),
    plans: plans.map(toOption),
    defaultPlanSlug: defaultPlan.slug,
    prefill: customer ? { fullName: customer.name, email: customer.email, phone: customer.phone ?? "" } : null,
    dishes,
    initialSelections,
    intro,
    initialCoupon: coupon ?? "",
    initialQuote: qc ? toQuoteView(qc) : null,
    areas: areas
      .filter((a) => a.deliveryAvailable)
      .map((a) => ({
        id: a.id,
        name: a.name,
        region: a.region,
        deliveryFeeCents: a.deliveryFeeCents,
        minOrderCents: a.minOrderCents,
        deliveryDays: a.deliveryDays,
        deliveryWindow: a.deliveryWindow,
        notes: a.notes,
      })),
    collectionPoints: points.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      instructions: p.instructions,
      availableDays: p.availableDays,
      timeWindows: p.timeWindows,
    })),
    fulfillment: {
      deliveryEnabled: settings.fulfillment.deliveryEnabled,
      collectionEnabled: settings.fulfillment.collectionEnabled,
      deliveryInfo: settings.fulfillment.deliveryInfo,
      collectionInfo: settings.fulfillment.collectionInfo,
      noDeliveryAreasMessage: settings.fulfillment.noDeliveryAreasMessage,
      gozoNote: settings.fulfillment.gozoNote,
    },
    form: {
      askWhatsapp: settings.orderForm.askWhatsapp,
      askStartDate: settings.orderForm.askStartDate,
      askDietaryPreferences: settings.orderForm.askDietaryPreferences,
      askAllergies: settings.orderForm.askAllergies,
      askSpecialInstructions: settings.orderForm.askSpecialInstructions,
      mealPreferenceOptions: settings.orderForm.mealPreferenceOptions,
      marketingOptInEnabled: settings.orderForm.marketingOptInEnabled,
      marketingConsentText: settings.orderForm.marketingConsentText,
      noPaymentNotice: settings.orderForm.noPaymentNotice,
      allergenNotice: settings.orderForm.allergenNotice,
    },
    declarationText: FIRST_ORDER_DECLARATION(brandName),
    minStartDate: earliestStartDate(now, cutoffConfig(f), f.leadTimeDays, tz),
    cutoff: cutoff
      ? {
          cutoff: cutoff.cutoff.toISOString(),
          cutoffDay: cutoff.cutoffDay,
          weekStart: cutoff.weekStart,
          timeLabel: formatTime12(f.weeklyCutoffTime),
          serverNow: now.toISOString(),
        }
      : null,
    maxStartDate: addDaysToDateString(today, 365),
    whatsappHref: wa,
    turnstileSiteKey: env().TURNSTILE_SITE_KEY ?? null,
  };

  return (
    <div className="bg-ink">
      <section className="container-site pb-8 pt-10 sm:pt-14">
        <Breadcrumbs items={[{ name: "Packages", path: "/plans" }, { name: "Build your package", path: "/order" }]} />
        <p className="eyebrow mt-8 text-fog">Build your package · No payment taken online</p>
        <h1 className="mt-3 display-xl">Build your package</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-fog sm:text-lg">
          Pick your meals and days, choose your dishes, and send your request. We&apos;ll confirm{" "}
          {settings.fulfillment.deliveryEnabled ? "delivery or collection" : "collection"} and payment with you personally.
        </p>
        <p className="mt-4 text-sm text-fog">
          {customer ? (
            <>
              Signed in as <strong className="text-white">{customer.firstName}</strong> — your details are filled in and this order will appear in{" "}
              <Link href="/account" className="text-white underline underline-offset-4">your account</Link>.
            </>
          ) : (
            <>
              Ordered before?{" "}
              <Link href="/account/sign-in?next=/order" className="text-white underline underline-offset-4">Sign in</Link> to fill in your details
              and keep track of your orders.
            </>
          )}
        </p>
      </section>
      <OrderForm {...props} />
    </div>
  );
}
