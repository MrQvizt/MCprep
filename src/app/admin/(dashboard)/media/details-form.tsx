"use client";

import { AdminForm, Field, NativeSelect, SubmitButton } from "@/components/admin/form";
import { Textarea } from "@/components/ui/textarea";
import { saveMediaDetails } from "./actions";

export function MediaDetailsForm({
  media,
  categories,
}: {
  media: { id: string; altText: string | null; caption: string | null; category: string };
  categories: Record<string, string>;
}) {
  return (
    <AdminForm action={saveMediaDetails.bind(null, media.id)} className="space-y-4">
      <Field
        label="Alt text"
        name="altText"
        hint="Describe what's in the photo, e.g. “Chicken Pokébowl with rice and greens”. Helps blind visitors and Google."
      >
        {(id) => <Textarea id={id} name="altText" defaultValue={media.altText ?? ""} rows={2} maxLength={300} />}
      </Field>
      <Field label="Caption (optional)" name="caption">
        {(id) => <Textarea id={id} name="caption" defaultValue={media.caption ?? ""} rows={2} maxLength={500} />}
      </Field>
      <Field label="Category" name="category">
        {(id) => (
          <NativeSelect id={id} name="category" defaultValue={media.category}>
            {Object.entries(categories).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <SubmitButton>Save details</SubmitButton>
    </AdminForm>
  );
}
