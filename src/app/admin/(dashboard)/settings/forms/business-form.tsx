"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AdminForm, CheckboxField, Field, FieldError, FormActions, NativeSelect, SubmitButton, useFormState } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SettingsOf } from "@/lib/settings/schema";
import { WEEKDAYS } from "@/lib/time";
import { saveSettingsSection } from "../actions";

type Row = { key: number; day: number; opens: string; closes: string };

function HoursEditor({ initial }: { initial: { day: number; opens: string; closes: string }[] }) {
  const [rows, setRows] = useState<Row[]>(initial.map((h, i) => ({ ...h, key: i })));
  const state = useFormState();
  const update = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Opening hours</legend>
      <p className="text-xs text-muted-foreground">
        Only add hours you have confirmed. Leave this empty if you don&apos;t have fixed opening hours — they&apos;re used for Google
        (structured data) and the contact page.
      </p>
      {rows.length === 0 && <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">No opening hours set.</p>}
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={row.key} className="flex flex-wrap items-center gap-2">
            <NativeSelect
              name="hoursDay"
              value={row.day}
              onChange={(e) => update(row.key, { day: Number(e.target.value) })}
              className="w-36"
              aria-label="Day"
            >
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={d}>
                  {WEEKDAYS[d]}
                </option>
              ))}
            </NativeSelect>
            <Input
              type="time"
              name="hoursOpens"
              value={row.opens}
              onChange={(e) => update(row.key, { opens: e.target.value })}
              className="w-32"
              aria-label="Opens"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="time"
              name="hoursCloses"
              value={row.closes}
              onChange={(e) => update(row.key, { closes: e.target.value })}
              className="w-32"
              aria-label="Closes"
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}>
              <Trash2 className="size-4" />
            </Button>
            {(state.fieldErrors?.[`openingHours.${i}.closes`] || state.fieldErrors?.[`openingHours.${i}.opens`]) && (
              <p className="w-full text-xs font-medium text-destructive" role="alert">
                {state.fieldErrors?.[`openingHours.${i}.closes`] ?? state.fieldErrors?.[`openingHours.${i}.opens`]}
              </p>
            )}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setRows((r) => [...r, { key: Date.now(), day: r.length ? (r[r.length - 1].day + 1) % 7 : 1, opens: "09:00", closes: "17:00" }])
        }
      >
        <Plus className="size-4" /> Add opening hours
      </Button>
    </fieldset>
  );
}

const TIME_ZONES = ["Europe/Malta", "Europe/Rome", "Europe/London", "UTC"];

export function BusinessForm({ values }: { values: SettingsOf<"business"> }) {
  return (
    <AdminForm action={saveSettingsSection.bind(null, "business")} className="space-y-8">
      <section className="grid gap-5 sm:grid-cols-2">
        <Field label="Trading name" name="tradingName" required hint="The name customers know you by.">
          {(id) => <Input id={id} name="tradingName" defaultValue={values.tradingName} maxLength={80} />}
        </Field>
        <Field label="Registered business name" name="registeredName" hint="As registered with the Malta Business Registry (shown in the footer and legal pages).">
          {(id) => <Input id={id} name="registeredName" defaultValue={values.registeredName} maxLength={120} />}
        </Field>
        <Field label="Tagline" name="tagline">
          {(id) => <Input id={id} name="tagline" defaultValue={values.tagline} maxLength={160} />}
        </Field>
        <Field label="Founded (optional)" name="foundingYear">
          {(id) => <Input id={id} name="foundingYear" defaultValue={values.foundingYear} inputMode="numeric" maxLength={4} className="max-w-28" />}
        </Field>
        <Field label="Short description" name="shortDescription" className="sm:col-span-2" hint="One or two sentences used for Google's business information.">
          {(id) => <Textarea id={id} name="shortDescription" defaultValue={values.shortDescription} rows={2} maxLength={300} />}
        </Field>
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold">Legal details</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="VAT number (optional)" name="vatNumber" hint="e.g. MT12345678. Shown in the footer when filled in.">
            {(id) => <Input id={id} name="vatNumber" defaultValue={values.vatNumber} maxLength={20} />}
          </Field>
          <Field label="Company registration (optional)" name="registrationNumber" hint="e.g. C 12345">
            {(id) => <Input id={id} name="registrationNumber" defaultValue={values.registrationNumber} maxLength={40} />}
          </Field>
        </div>
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold">Address</h3>
        <p className="text-sm text-muted-foreground">
          If you deliver from a home kitchen or don&apos;t have a shop front, keep the address private — it&apos;s then never shown on the
          website or to Google.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Address line 1" name="addressLine1">
            {(id) => <Input id={id} name="addressLine1" defaultValue={values.addressLine1} maxLength={120} />}
          </Field>
          <Field label="Address line 2" name="addressLine2">
            {(id) => <Input id={id} name="addressLine2" defaultValue={values.addressLine2} maxLength={120} />}
          </Field>
          <Field label="Locality" name="addressLocality" hint="e.g. Birkirkara">
            {(id) => <Input id={id} name="addressLocality" defaultValue={values.addressLocality} maxLength={80} />}
          </Field>
          <Field label="Postcode" name="addressPostalCode" hint="e.g. BKR 1234">
            {(id) => <Input id={id} name="addressPostalCode" defaultValue={values.addressPostalCode} maxLength={10} className="max-w-36" />}
          </Field>
        </div>
        <CheckboxField
          name="showAddressPublicly"
          label="Show this address publicly"
          hint="Displays it in the footer and tells Google where the business is. Only for a real public location."
          defaultChecked={values.showAddressPublicly}
        />
        <FieldError name="showAddressPublicly" />
        <p className="text-xs text-muted-foreground">Country: Malta</p>
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold">Opening hours &amp; service area</h3>
        <HoursEditor initial={values.openingHours} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Opening hours note (optional)" name="openingHoursNote" hint="e.g. Orders by message 7 days a week.">
            {(id) => <Input id={id} name="openingHoursNote" defaultValue={values.openingHoursNote} maxLength={300} />}
          </Field>
          <Field label="Area served" name="areaServedText" hint="Used for Google when no delivery localities are switched on, e.g. Malta.">
            {(id) => <Input id={id} name="areaServedText" defaultValue={values.areaServedText} maxLength={160} />}
          </Field>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-3">
        <Field label="Business type for Google" name="businessType" hint="“Food business” suits meal prep kitchens.">
          {(id) => (
            <NativeSelect id={id} name="businessType" defaultValue={values.businessType}>
              <option value="LocalBusiness">Local business</option>
              <option value="FoodEstablishment">Food business</option>
            </NativeSelect>
          )}
        </Field>
        <Field label="Time zone" name="timeZone" hint="Used for countdowns, order times and reports.">
          {(id) => (
            <NativeSelect id={id} name="timeZone" defaultValue={values.timeZone}>
              {[...new Set([values.timeZone, ...TIME_ZONES])].map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Currency" name="currency">
          {(id) => (
            <NativeSelect id={id} name="currency" defaultValue="EUR">
              <option value="EUR">Euro (€)</option>
            </NativeSelect>
          )}
        </Field>
      </section>

      <FormActions>
        <SubmitButton>Save business details</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
