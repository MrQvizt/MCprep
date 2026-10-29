import { ServicePage } from "@/components/public/service-page";
import { staticPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return staticPageMetadata("high-protein-meals-malta");
}

export default function HighProteinMealsMaltaPage() {
  return <ServicePage contentKey="service.highProteinMealsMalta" pageKey="high-protein-meals-malta" />;
}
