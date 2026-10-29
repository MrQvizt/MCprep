"use client";

import { AdminCard } from "@/components/admin/page-header";
import { AdminForm, CheckboxField, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveTestimonial } from "./actions";

export interface TestimonialFormValues {
  id: string;
  quote: string;
  displayName: string;
  context: string | null;
  photo: PickedMedia | null;
  source: string | null;
  consentDate: string; // YYYY-MM-DD or ""
  consentNotes: string | null;
  isPublished: boolean;
}

export function TestimonialForm({ testimonial }: { testimonial?: TestimonialFormValues }) {
  return (
    <AdminForm action={saveTestimonial.bind(null, testimonial?.id ?? null)} className="max-w-3xl space-y-6">
      <AdminCard title="Testimonial">
        <div className="grid gap-5">
          <Field label="Quote" name="quote" required hint="Use the customer's own words. Don't edit the meaning.">
            {(id) => <Textarea id={id} name="quote" defaultValue={testimonial?.quote ?? ""} rows={4} maxLength={800} />}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Display name" name="displayName" required hint="As the customer agreed, e.g. “Maria B.” or initials.">
              {(id) => <Input id={id} name="displayName" defaultValue={testimonial?.displayName ?? ""} maxLength={60} />}
            </Field>
            <Field label="Context (optional)" name="context" hint="e.g. 2-week plan customer">
              {(id) => <Input id={id} name="context" defaultValue={testimonial?.context ?? ""} maxLength={80} />}
            </Field>
            <Field label="Where it came from (optional)" name="source" hint="e.g. Instagram DM, WhatsApp, email">
              {(id) => <Input id={id} name="source" defaultValue={testimonial?.source ?? ""} maxLength={80} />}
            </Field>
          </div>
          <MediaPicker name="photoId" label="Photo (optional, with permission)" category="TESTIMONIAL" defaultValue={testimonial?.photo ?? null} aspect="aspect-square" />
        </div>
      </AdminCard>
      <AdminCard
        title="Permission"
        description="Only publish genuine testimonials, and only with the customer's permission. Record when and how they agreed."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date permission was given" name="consentDate">
            {(id) => <Input id={id} type="date" name="consentDate" defaultValue={testimonial?.consentDate ?? ""} className="max-w-48" />}
          </Field>
          <Field label="How they agreed" name="consentNotes" hint="e.g. “Agreed by WhatsApp, name and quote approved”.">
            {(id) => <Input id={id} name="consentNotes" defaultValue={testimonial?.consentNotes ?? ""} maxLength={500} />}
          </Field>
        </div>
        <div className="mt-5">
          <CheckboxField name="isPublished" label="Publish on the website" hint="Requires the permission date above." defaultChecked={testimonial?.isPublished ?? false} />
        </div>
      </AdminCard>
      <FormActions>
        <SubmitButton>{testimonial ? "Save testimonial" : "Add testimonial"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
