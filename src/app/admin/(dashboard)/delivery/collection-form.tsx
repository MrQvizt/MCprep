"use client";

import { AdminForm, CheckboxField, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCollectionPoint } from "./actions";
import { WeekdayCheckboxes } from "./weekday-checkboxes";

export interface CollectionFormValues {
  id: string;
  name: string;
  address: string | null;
  showAddressPublicly: boolean;
  instructions: string | null;
  availableDays: number[];
  timeWindows: string | null;
  isActive: boolean;
}

export function CollectionForm({ point }: { point?: CollectionFormValues }) {
  return (
    <AdminForm action={saveCollectionPoint.bind(null, point?.id ?? null)} className="max-w-3xl space-y-6">
      <Field label="Name" name="name" required hint="How customers will see it, e.g. “MC PREPS kitchen” or “Gym collection point”.">
        {(id) => <Input id={id} name="name" defaultValue={point?.name} maxLength={80} />}
      </Field>
      <Field label="Address" name="address" hint="Only enter a real, confirmed address.">
        {(id) => <Textarea id={id} name="address" defaultValue={point?.address ?? ""} rows={3} maxLength={400} />}
      </Field>
      <CheckboxField
        name="showAddressPublicly"
        label="Show the address publicly"
        hint="If unticked, the address is only shared with customers when you confirm their order."
        defaultChecked={point?.showAddressPublicly ?? false}
      />
      <WeekdayCheckboxes name="availableDays" legend="Collection days" defaultValue={point?.availableDays} />
      <Field label="Collection times (optional)" name="timeWindows" hint="e.g. Sunday 17:00–19:00, Wednesday 18:00–20:00">
        {(id) => <Input id={id} name="timeWindows" defaultValue={point?.timeWindows ?? ""} maxLength={300} />}
      </Field>
      <Field label="Instructions (optional)" name="instructions" hint="e.g. Ring the bell at the side entrance. Bring your order reference.">
        {(id) => <Textarea id={id} name="instructions" defaultValue={point?.instructions ?? ""} rows={3} maxLength={800} />}
      </Field>
      <CheckboxField
        name="isActive"
        label="Active"
        hint="Customers choosing collection see active collection points."
        defaultChecked={point?.isActive ?? true}
      />
      <FormActions>
        <SubmitButton>{point ? "Save collection point" : "Add collection point"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
