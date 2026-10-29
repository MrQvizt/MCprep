import { ServicePage } from "@/components/public/service-page";
import { staticPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return staticPageMetadata("meal-prep-malta");
}

export default function MealPrepMaltaPage() {
  return <ServicePage contentKey="service.mealPrepMalta" pageKey="meal-prep-malta" />;
}
