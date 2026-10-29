import { LegalPage } from "@/components/public/legal-page";
import { staticPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return staticPageMetadata("privacy-policy");
}

export default function PrivacyPolicyPage() {
  return <LegalPage contentKey="legal.privacy" pageKey="privacy-policy" showBusinessDetails />;
}
