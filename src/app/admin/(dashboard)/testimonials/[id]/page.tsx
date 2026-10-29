import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AREA_ROLES, requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { MEDIA_SELECT } from "@/lib/media";
import { zonedDateString } from "@/lib/time";
import { TestimonialForm } from "../testimonial-form";

export const metadata = { title: "Edit testimonial" };

export default async function EditTestimonialPage({ params }: PageProps<"/admin/testimonials/[id]">) {
  await requireAdmin(AREA_ROLES.testimonials);
  const { id } = await params;
  const t = await db.testimonial.findUnique({ where: { id }, include: { photo: { select: MEDIA_SELECT } } });
  if (!t) notFound();
  return (
    <>
      <AdminPageHeader title="Edit testimonial" back={{ href: "/admin/testimonials", label: "Testimonials" }} />
      <TestimonialForm
        testimonial={{ ...t, photo: t.photo, consentDate: t.consentRecordedAt ? zonedDateString(t.consentRecordedAt) : "" }}
      />
    </>
  );
}
