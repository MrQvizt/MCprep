"use client";

import { AdminForm, CheckboxField, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { Textarea } from "@/components/ui/textarea";
import type { SettingsOf } from "@/lib/settings/schema";
import { saveSettingsSection } from "../actions";

export function OrderFormForm({ values }: { values: SettingsOf<"orderForm"> }) {
  return (
    <AdminForm action={saveSettingsSection.bind(null, "order-form")} className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Optional questions</h3>
        <p className="text-sm text-muted-foreground">
          Name, email, phone and plan are always asked. Only ask what you need — less is better for customers and for privacy.
        </p>
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <CheckboxField name="askWhatsapp" label="WhatsApp number" defaultChecked={values.askWhatsapp} />
          <CheckboxField name="askStartDate" label="Preferred start date" defaultChecked={values.askStartDate} />
          <CheckboxField name="askDietaryPreferences" label="Dietary preferences" defaultChecked={values.askDietaryPreferences} />
          <CheckboxField
            name="askAllergies"
            label="Allergies & intolerances"
            hint="Strongly recommended. Customers give explicit consent before sharing."
            defaultChecked={values.askAllergies}
          />
          <CheckboxField name="askSpecialInstructions" label="Special instructions" defaultChecked={values.askSpecialInstructions} />
        </div>
      </section>

      <Field
        label="Meal preference options"
        name="mealPreferenceOptions"
        hint="One per line, e.g. “Standard high-protein”. Only list options you really offer. Leave empty to hide this question."
      >
        {(id) => <Textarea id={id} name="mealPreferenceOptions" defaultValue={values.mealPreferenceOptions.join("\n")} rows={4} />}
      </Field>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Emails &amp; marketing</h3>
        <CheckboxField
          name="sendCustomerConfirmation"
          label="Email customers a confirmation of their request"
          hint="Tells them the request was received, no payment was taken and you'll be in touch."
          defaultChecked={values.sendCustomerConfirmation}
        />
        <CheckboxField
          name="marketingOptInEnabled"
          label="Show an optional marketing-emails checkbox"
          hint="Always unticked by default and separate from the order — customers are never subscribed automatically."
          defaultChecked={values.marketingOptInEnabled}
        />
        <Field label="Marketing consent wording" name="marketingConsentText" hint="The exact sentence customers agree to. It is saved with each consent.">
          {(id) => <Textarea id={id} name="marketingConsentText" defaultValue={values.marketingConsentText} rows={2} maxLength={500} />}
        </Field>
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold">Notices on the order form</h3>
        <Field label="No-payment notice" name="noPaymentNotice" required>
          {(id) => <Textarea id={id} name="noPaymentNotice" defaultValue={values.noPaymentNotice} rows={3} maxLength={600} />}
        </Field>
        <Field label="Allergen notice" name="allergenNotice" required hint="Have this checked against how your kitchen really works.">
          {(id) => <Textarea id={id} name="allergenNotice" defaultValue={values.allergenNotice} rows={4} maxLength={1000} />}
        </Field>
      </section>

      <FormActions>
        <SubmitButton>Save order form</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
