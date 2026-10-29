import { LegalPage } from "@/components/public/legal-page";
import { staticPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return staticPageMetadata("cookie-policy");
}

export default function CookiePolicyPage() {
  return <LegalPage contentKey="legal.cookies" pageKey="cookie-policy" />;
}
