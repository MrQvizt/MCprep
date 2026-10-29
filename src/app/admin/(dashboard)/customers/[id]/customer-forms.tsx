"use client";

import { AdminForm, Field, NativeSelect, SubmitButton } from "@/components/admin/form";
import { Textarea } from "@/components/ui/textarea";
import { saveCustomerNotesAction, setCustomerStatusAction } from "../actions";

export function CustomerStatusForm({ customerId, current }: { customerId: string; current: "AUTO" | "FIRST_TIME" | "EXISTING" }) {
  return (
    <AdminForm action={setCustomerStatusAction.bind(null, customerId)} className="space-y-3">
      <Field
        label="Treat this person as"
        name="manualStatus"
        hint="Affects first-order promotion checks. “Automatic” decides from confirmed orders. Every change is recorded."
      >
        {(id) => (
          <NativeSelect id={id} name="manualStatus" defaultValue={current}>
            <option value="AUTO">Automatic (based on order history)</option>
            <option value="FIRST_TIME">First-time customer</option>
            <option value="EXISTING">Existing customer</option>
          </NativeSelect>
        )}
      </Field>
      <SubmitButton size="default">Save</SubmitButton>
    </AdminForm>
  );
}

export function CustomerNotesForm({ customerId, notes }: { customerId: string; notes: string | null }) {
  return (
    <AdminForm action={saveCustomerNotesAction.bind(null, customerId)} className="space-y-3">
      <Field label="Team notes" name="notes" hint="Private notes for your team, e.g. preferences or how they like to be contacted.">
        {(id) => <Textarea id={id} name="notes" defaultValue={notes ?? ""} rows={4} maxLength={4000} />}
      </Field>
      <SubmitButton size="default">Save notes</SubmitButton>
    </AdminForm>
  );
}
