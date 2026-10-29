import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { FaqForm } from "../faq-form";

export const metadata = { title: "Edit FAQ" };

export default async function EditFaqPage({ params }: PageProps<"/admin/faqs/[id]">) {
  await requireAdmin(AREA_ROLES.faqs);
  const { id } = await params;
  const faq = await db.fAQ.findUnique({ where: { id } });
  if (!faq) notFound();
  return (
    <>
      <AdminPageHeader title="Edit FAQ" back={{ href: "/admin/faqs", label: "All FAQs" }} />
      <FaqForm faq={faq} />
    </>
  );
}
