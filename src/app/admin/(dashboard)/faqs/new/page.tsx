import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { FaqForm } from "../faq-form";

export const metadata = { title: "New FAQ" };

export default async function NewFaqPage() {
  await requireAdmin(AREA_ROLES.faqs);
  return (
    <>
      <AdminPageHeader title="New FAQ" back={{ href: "/admin/faqs", label: "All FAQs" }} />
      <FaqForm />
    </>
  );
}
