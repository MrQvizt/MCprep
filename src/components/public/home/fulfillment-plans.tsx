import Link from "next/link";
import { ArrowRight, MapPin, Package, Truck } from "lucide-react";
import { WhatsAppIcon } from "@/components/shared/icons";
import type { ContentOf } from "@/lib/content/schema";
import type { getCollectionPoints, getDeliveryAreas, PublicPlan } from "@/lib/public-data";
import type { AllSettings } from "@/lib/settings/schema";
import { formatWeekdays } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PlanCard } from "../plan-card";
import { Reveal } from "../reveal";
import { Section } from "../section";
import { TrackInView } from "../track-in-view";

export type PublicAreas = Awaited<ReturnType<typeof getDeliveryAreas>>;
export type PublicCollectionPoints = Awaited<ReturnType<typeof getCollectionPoints>>;

export function HomeFulfillment({
  content,
  areas,
  points,
  fulfillment,
  whatsappHref,
}: {
  content: ContentOf<"home.fulfillment">;
  areas: PublicAreas;
  points: PublicCollectionPoints;
  fulfillment: AllSettings["fulfillment"];
  whatsappHref: string | null;
}) {
  const served = areas.filter((a) => a.deliveryAvailable);
  const showDelivery = fulfillment.deliveryEnabled;
  const showCollection = fulfillment.collectionEnabled;
  if (!showDelivery && !showCollection) return null;
  return (
    <Section tone="mist" aria-labelledby="fulfilment-title">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="eyebrow mb-4 text-smoke">{content.eyebrow}</p>
          <h2 id="fulfilment-title" className="display-lg text-balance">
            {content.heading}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-smoke">{content.body}</p>
        </div>
        <div className={cn("grid gap-4 lg:col-span-8", showDelivery && showCollection && "md:grid-cols-2")}>
          {showCollection && (
            <Reveal className="flex flex-col border border-ink/10 bg-paper p-7 sm:p-8">
              <Package className="size-7" aria-hidden="true" />
              <h3 className="mt-6 display-md">{content.collectionTitle}</h3>
              <p className="mt-3 text-sm leading-relaxed text-smoke">{fulfillment.collectionInfo || content.collectionBody}</p>
              {points.length > 0 && (
                <ul className="mt-6 space-y-4 border-t border-ink/10 pt-6 text-sm">
                  {points.map((p) => (
                    <li key={p.id}>
                      <p className="font-semibold">{p.name}</p>
                      {p.address && <p className="text-smoke">{p.address}</p>}
                      {p.availableDays.length > 0 && <p className="text-smoke">{formatWeekdays(p.availableDays)}</p>}
                      {p.timeWindows && <p className="text-smoke">{p.timeWindows}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Reveal>
          )}
          {showDelivery && (
            <Reveal delay={90} className="flex flex-col border border-ink bg-ink p-7 text-white sm:p-8">
              <Truck className="size-7" aria-hidden="true" />
              <h3 className="mt-6 display-md">{content.deliveryTitle}</h3>
              <p className="mt-3 text-sm leading-relaxed text-fog">{fulfillment.deliveryInfo || content.deliveryBody}</p>
              {served.length > 0 ? (
                <ul className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-6" aria-label="Delivery localities">
                  {served.slice(0, 14).map((a) => (
                    <li key={a.id} className="inline-flex items-center gap-1.5 border border-white/20 px-2.5 py-1 text-xs">
                      <MapPin className="size-3" aria-hidden="true" />
                      {a.name}
                    </li>
                  ))}
                  {served.length > 14 && <li className="px-2.5 py-1 text-xs text-fog">+{served.length - 14} more</li>}
                </ul>
              ) : (
                <p className="mt-6 border-t border-white/10 pt-6 text-sm text-fog">{fulfillment.noDeliveryAreasMessage}</p>
              )}
              <div className="mt-auto flex flex-wrap gap-x-6 gap-y-3 pt-8 text-xs font-semibold uppercase tracking-[0.16em]">
                <Link href="/delivery-areas" className="inline-flex items-center gap-2 underline-offset-8 hover:underline">
                  Delivery areas <ArrowRight className="size-4" />
                </Link>
                {served.length === 0 && whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-track="click_whatsapp"
                    className="inline-flex items-center gap-2 underline-offset-8 hover:underline"
                  >
                    <WhatsAppIcon className="size-4" /> Ask on WhatsApp
                  </a>
                )}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </Section>
  );
}

export function PlansGrid({
  plans,
  currency,
  orderParams,
  className,
}: {
  plans: PublicPlan[];
  currency: string;
  orderParams?: Record<string, string | null | undefined>;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "grid gap-5 pt-3 md:items-stretch",
        plans.length === 1 ? "mx-auto max-w-md" : plans.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
        className,
      )}
    >
      {plans.map((plan, i) => (
        <Reveal as="li" key={plan.id} delay={i * 90} className={cn(plan.isRecommended && "md:-mt-3 md:mb-3")}>
          <PlanCard plan={plan} currency={currency} orderParams={orderParams} className="h-full" />
        </Reveal>
      ))}
    </ul>
  );
}

export function HomePlans({ content, plans, currency }: { content: ContentOf<"home.plans">; plans: PublicPlan[]; currency: string }) {
  if (plans.length === 0) return null;
  return (
    <Section tone="ink" aria-labelledby="plans-title" id="plans">
      <TrackInView event="view_pricing" />
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow mb-4 text-fog">{content.eyebrow}</p>
        <h2 id="plans-title" className="display-xl text-balance">
          {content.heading}
        </h2>
        {content.subheading && <p className="mt-5 text-base text-white/70 sm:text-lg">{content.subheading}</p>}
      </div>
      <PlansGrid plans={plans} currency={currency} className="mt-14 lg:mt-20" />
      <p className="mt-10 text-center text-xs uppercase tracking-[0.16em] text-fog">
        No payment online · We confirm every order personally
      </p>
    </Section>
  );
}
