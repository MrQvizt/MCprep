"use client";

import { AdminForm, CheckboxField, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveFaq } from "./actions";

export interface FaqFormValues {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  isPublished: boolean;
  showOnHomepage: boolean;
}

export function FaqForm({ faq }: { faq?: FaqFormValues }) {
  return (
    <AdminForm action={saveFaq.bind(null, faq?.id ?? null)} className="max-w-3xl space-y-6">
      <Field label="Question" name="question" required hint="Write it the way a customer would ask it.">
        {(id) => <Input id={id} name="question" defaultValue={faq?.question} maxLength={240} />}
      </Field>
      <Field label="Answer" name="answer" required hint="Plain text. Leave a blank line between paragraphs.">
        {(id) => <Textarea id={id} name="answer" defaultValue={faq?.answer} rows={6} maxLength={2000} />}
      </Field>
      <Field label="Category (optional)" name="category" hint="e.g. Ordering, Delivery, Allergies. Used to group questions on the FAQ page.">
        {(id) => <Input id={id} name="category" defaultValue={faq?.category ?? ""} maxLength={60} />}
      </Field>
      <div className="space-y-3 rounded-lg border p-4">
        <CheckboxField name="isPublished" label="Published" hint="Show this question on the website." defaultChecked={faq?.isPublished ?? true} />
        <CheckboxField name="showOnHomepage" label="Show on homepage" hint="Also include it in the homepage FAQ section." defaultChecked={faq?.showOnHomepage ?? true} />
      </div>
      <FormActions>
        <SubmitButton>{faq ? "Save changes" : "Create FAQ"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
