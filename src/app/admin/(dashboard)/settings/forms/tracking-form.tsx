"use client";

import { AdminForm, CheckboxField, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import type { SettingsOf } from "@/lib/settings/schema";
import { saveSettingsSection } from "../actions";

export function TrackingForm({ values }: { values: SettingsOf<"tracking"> }) {
  const thirdParty = Boolean(values.ga4MeasurementId || values.gtmContainerId || values.metaPixelId || values.googleAdsId);
  return (
    <AdminForm action={saveSettingsSection.bind(null, "tracking")} className="space-y-8">
      <section className="space-y-3 rounded-lg border p-4">
        <CheckboxField
          name="firstPartyAnalyticsEnabled"
          label="Count visits and clicks on this website"
          hint="Cookieless and anonymous: no cookies, no IP addresses and no personal details are stored. Powers Growth & performance."
          defaultChecked={values.firstPartyAnalyticsEnabled}
        />
        <CheckboxField
          name="consentBannerEnabled"
          label="Show the cookie consent banner"
          hint="Needed for the tools below. Google Analytics, Tag Manager, Meta Pixel and Google Ads only load after a visitor clicks “Accept”."
          defaultChecked={values.consentBannerEnabled}
        />
        {thirdParty && !values.consentBannerEnabled && (
          <p className="text-xs font-medium text-amber-800">
            The banner is off, so the tracking tools below will never load. Switch it on to use them.
          </p>
        )}
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold">Optional tracking tools</h3>
        <p className="text-sm text-muted-foreground">
          Paste the IDs from each tool. Leave blank if you don&apos;t use it. Visitor names, emails, phone numbers, addresses and
          allergy notes are never sent to these tools. Remember to mention any tool you use in your Cookie Policy.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Google Analytics 4 measurement ID" name="ga4MeasurementId" hint="Looks like G-XXXXXXXXXX (Admin → Data streams).">
            {(id) => <Input id={id} name="ga4MeasurementId" defaultValue={values.ga4MeasurementId} placeholder="G-" maxLength={20} />}
          </Field>
          <Field label="Google Tag Manager container ID" name="gtmContainerId" hint="Looks like GTM-XXXXXXX. Use instead of GA4 if your agency set up GTM.">
            {(id) => <Input id={id} name="gtmContainerId" defaultValue={values.gtmContainerId} placeholder="GTM-" maxLength={20} />}
          </Field>
          <Field label="Meta Pixel ID (future ads)" name="metaPixelId" hint="A long number from Meta Events Manager. Loads only with marketing consent.">
            {(id) => <Input id={id} name="metaPixelId" defaultValue={values.metaPixelId} inputMode="numeric" maxLength={20} />}
          </Field>
          <Field label="Google Ads ID (future ads)" name="googleAdsId" hint="Looks like AW-123456789. Loads only with marketing consent.">
            {(id) => <Input id={id} name="googleAdsId" defaultValue={values.googleAdsId} placeholder="AW-" maxLength={20} />}
          </Field>
          <Field label="Google Ads conversion label" name="googleAdsConversionLabel" hint="Optional — from your Google Ads conversion action.">
            {(id) => <Input id={id} name="googleAdsConversionLabel" defaultValue={values.googleAdsConversionLabel} maxLength={100} />}
          </Field>
        </div>
      </section>
      <FormActions>
        <SubmitButton>Save analytics settings</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
