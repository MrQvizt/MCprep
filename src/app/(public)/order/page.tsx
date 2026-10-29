import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { CtaLink } from "@/components/public/cta-link";
import { quoteForOrder } from "@/lib/orders/service";
import { FIRST_ORDER_DECLARATION } from "@/lib/orders/schema";
import { getCollectionPoints, getDeliveryAreas, getPublicPlans, requestNow } from "@/lib/public-data";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings";
import { addDaysToDateString, zonedDateString } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";
import { env } from "@/lib/env";
import { discountLabel, COUPON_MESSAGES } from "@/lib/pricing";
import { OrderForm, type OrderFormProps } from "./order-form";
import type { QuoteView } from "./actions";

export async function generateMetadata() {
  return staticPageMetadata("order");
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v.slice(0, 80) : undefined;
}

export default async function OrderPage({ searchParams }: PageProps<"/order">) {
  const sp = await searchParams;
  const now = await requestNow();
  const [settings, plans, areas, points] = await Promise.all([
    getSettings(),
    getPublicPlans(),
    getDeliveryAreas(),
    getCollectionPoints(),
  ]);
  const brandName = settings.business.tradingName;
  const c = settings.contact;
  const wa = whatsappLink(c.whatsappNumber, c.whatsappDefaultMessage);

  if (plans.length === 0) {
    return (
      <section className="container-site py-24">
        <h1 className="display-lg">Order requests are paused</h1>
        <p className="mt-4 max-w-xl text-fog">
          Our meal plans are being updated. Message us and we&apos;ll help you directly.
        </p>
        {wa && (
          <CtaLink href={wa} className="mt-8">
            Message us on WhatsApp
          </CtaLink>
        )}
      </section>
    );
  }

  const requested = str(sp.plan);
  const defaultPlan =
    plans.find((p) => p.slug === requested) ?? plans.find((p) => p.isRecommended) ?? plans[0];
  const coupon = str(sp.code)?.toUpperCase();

  const qc = await quoteForOrder({ planSlug: defaultPlan.slug, couponCode: coupon, now });
  const initialQuote: QuoteView | null = qc
    ? {
        planName: qc.plan.name,
        basePriceCents: qc.quote.basePriceCents,
        discountCents: qc.quote.discountCents,
        deliveryFeeCents: qc.quote.deliveryFeeCents,
        totalCents: qc.quote.totalCents,
        promotion: qc.quote.promotion
          ? {
              name: qc.quote.promotion.name,
              label: discountLabel(qc.quote.promotion),
              endsAt: qc.quote.promotion.endsAt.toISOString(),
              audience: qc.quote.promotion.audience,
            }
          : null,
        requiresVerification: qc.quote.requiresVerification,
        couponStatus: qc.quote.couponStatus,
        couponMessage: COUPON_MESSAGES[qc.quote.couponStatus],
        firstOrderOffer: qc.quote.availableFirstOrderOffer
          ? {
              name: qc.quote.availableFirstOrderOffer.name,
              discountCents: qc.quote.availableFirstOrderOffer.discountCents,
              endsAt: qc.quote.availableFirstOrderOffer.endsAt.toISOString(),
            }
          : null,
        minOrderShortfallCents: null,
        deliveryAreaName: null,
      }
    : null;

  const today = zonedDateString(now, settings.business.timeZone);
  const props: OrderFormProps = {
    brandName,
    currency: settings.business.currency || "EUR",
    serverNow: now.toISOString(),
    plans: plans.map((p) => ({
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      durationDays: p.durationDays,
      mealsIncluded: p.mealsIncluded,
      priceCents: p.priceCents,
      isRecommended: p.isRecommended,
      offerPriceCents: p.offer?.priceCents ?? null,
      offerFirstOrderOnly: p.offer?.firstOrderOnly ?? false,
    })),
    defaultPlanSlug: defaultPlan.slug,
    initialCoupon: coupon ?? "",
    initialQuote,
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
    minStartDate: addDaysToDateString(today, settings.fulfillment.leadTimeDays),
    maxStartDate: addDaysToDateString(today, 365),
    whatsappHref: wa,
    turnstileSiteKey: env().TURNSTILE_SITE_KEY ?? null,
  };

  return (
    <div className="bg-ink">
      <section className="container-site pb-10 pt-10 sm:pt-14">
        <Breadcrumbs items={[{ name: "Plans", path: "/plans" }, { name: "Order request", path: "/order" }]} />
        <p className="eyebrow mt-8 text-fog">Order request · No payment taken online</p>
        <h1 className="mt-3 display-xl">Request your plan</h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-fog sm:text-lg">
          Tell us what you&apos;d like and how you&apos;d like to receive it. Our team will contact you to confirm
          availability, {settings.fulfillment.deliveryEnabled ? "delivery or collection" : "collection"} details and payment.
        </p>
      </section>
      <OrderForm {...props} />
    </div>
  );
}
