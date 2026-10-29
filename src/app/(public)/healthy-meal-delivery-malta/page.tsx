import { ServicePage } from "@/components/public/service-page";
import { staticPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return staticPageMetadata("healthy-meal-delivery-malta");
}

export default function HealthyMealDeliveryMaltaPage() {
  return <ServicePage contentKey="service.healthyMealDeliveryMalta" pageKey="healthy-meal-delivery-malta" />;
}
