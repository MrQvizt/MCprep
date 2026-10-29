"use client";

import { AdminForm, CheckboxField, Field, FieldError, FormActions, SubmitButton } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SettingsOf } from "@/lib/settings/schema";
import { saveFulfillmentSettings } from "./actions";

export function FulfillmentForm({ values }: { values: SettingsOf<"fulfillment"> }) {
  return (
    <AdminForm action={saveFulfillmentSettings} className="space-y-6">
      <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <CheckboxField
          name="collectionEnabled"
          label="Offer collection"
          hint="Customers can choose to collect their meals."
          defaultChecked={values.collectionEnabled}
        />
        <CheckboxField
          name="deliveryEnabled"
          label="Offer delivery"
          hint="Customers can choose delivery to one of your switched-on localities."
          defaultChecked={values.deliveryEnabled}
        />
        <div className="sm:col-span-2">
          <FieldError name="deliveryEnabled" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Field label="Delivery information" name="deliveryInfo" hint="Shown to customers when they choose delivery, e.g. how deliveries work. Leave blank if not confirmed yet.">
          {(id) => <Textarea id={id} name="deliveryInfo" defaultValue={values.deliveryInfo} rows={4} maxLength={1500} />}
        </Field>
        <Field label="Collection information" name="collectionInfo" hint="Shown when customers choose collection. Don't include an address you don't want public.">
          {(id) => <Textarea id={id} name="collectionInfo" defaultValue={values.collectionInfo} rows={4} maxLength={1500} />}
        </Field>
        <Field label="Message when no localities are switched on" name="noDeliveryAreasMessage" hint="Shown in the order form if delivery is on but no locality is available yet.">
          {(id) => <Textarea id={id} name="noDeliveryAreasMessage" defaultValue={values.noDeliveryAreasMessage} rows={3} maxLength={600} />}
        </Field>
        <Field label="Gozo note (optional)" name="gozoNote" hint="Only if you have something to say about Gozo, e.g. whether you deliver there.">
          {(id) => <Textarea id={id} name="gozoNote" defaultValue={values.gozoNote} rows={3} maxLength={600} />}
        </Field>
        <Field
          label="Earliest start (days from today)"
          name="leadTimeDays"
          hint="How many days ahead customers must pick their preferred start date. 1 = tomorrow at the earliest."
        >
          {(id) => <Input id={id} name="leadTimeDays" type="number" min={0} max={60} defaultValue={values.leadTimeDays} className="max-w-32" />}
        </Field>
      </div>
      <FormActions>
        <SubmitButton>Save collection &amp; delivery settings</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
