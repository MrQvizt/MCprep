import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { TestimonialForm } from "../testimonial-form";

export const metadata = { title: "Add testimonial" };

export default async function NewTestimonialPage() {
  await requireAdmin(AREA_ROLES.testimonials);
  return (
    <>
      <AdminPageHeader title="Add testimonial" back={{ href: "/admin/testimonials", label: "Testimonials" }} />
      <TestimonialForm />
    </>
  );
}
