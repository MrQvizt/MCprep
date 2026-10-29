import { ServicePage } from "@/components/public/service-page";
import { staticPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return staticPageMetadata("meal-plans-malta");
}

export default function MealPlansMaltaPage() {
  return <ServicePage contentKey="service.mealPlansMalta" pageKey="meal-plans-malta" />;
}
