import { LegalPage } from "@/components/public/legal-page";
import { staticPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return staticPageMetadata("terms");
}

export default function TermsPage() {
  return <LegalPage contentKey="legal.terms" pageKey="terms" />;
}
