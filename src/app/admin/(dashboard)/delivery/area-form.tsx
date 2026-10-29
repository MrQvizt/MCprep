"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AdminForm, CheckboxField, Field, FieldError, FormActions, NativeSelect, SubmitButton } from "@/components/admin/form";
import { MoneyInput } from "@/components/admin/inputs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/urls";
import { saveDeliveryAreaAction } from "./actions";
import { WeekdayCheckboxes } from "./weekday-checkboxes";

export interface AreaFormValues {
  id: string;
  name: string;
  slug: string;
  region: "MALTA" | "GOZO" | "COMINO";
  deliveryAvailable: boolean;
  isPublished: boolean;
  deliveryFeeCents: number | null;
  minOrderCents: number | null;
  deliveryDays: number[];
  deliveryWindow: string | null;
  notes: string | null;
  zone: string | null;
  hasPublicPage: boolean;
  pageIntro: string | null;
  pageBody: string | null;
}

const MIN_WORDS = 150;
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function AreaForm({ area }: { area?: AreaFormValues }) {
  const [name, setName] = useState(area?.name ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(area));
  const [slug, setSlug] = useState(area?.slug ?? "");
  const [publicPage, setPublicPage] = useState(area?.hasPublicPage ?? false);
  const [body, setBody] = useState(area?.pageBody ?? "");
  const count = words(body);

  return (
    <AdminForm action={saveDeliveryAreaAction.bind(null, area?.id ?? null)} className="max-w-3xl space-y-8">
      <section className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Locality" name="name" required hint="As customers know it, e.g. Sliema, St Julian's, Gżira.">
            {(id) => (
              <Input
                id={id}
                name="name"
                value={name}
                maxLength={80}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            )}
          </Field>
          <Field label="Region" name="region">
            {(id) => (
              <NativeSelect id={id} name="region" defaultValue={area?.region ?? "MALTA"}>
                <option value="MALTA">Malta</option>
                <option value="GOZO">Gozo</option>
                <option value="COMINO">Comino</option>
              </NativeSelect>
            )}
          </Field>
        </div>
        <Field label="Web address (slug)" name="slug" hint="Used for the optional locality page: /delivery-areas/your-slug">
          {(id) => (
            <Input
              id={id}
              name="slug"
              value={slug}
              maxLength={80}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          )}
        </Field>
      </section>

      <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
        <p className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Only switch delivery on for localities you actually deliver to. Customers can only choose switched-on localities.
        </p>
        <CheckboxField
          name="deliveryAvailable"
          label="We deliver to this locality"
          hint="I confirm the business really delivers here. Customers can select it in the order form."
          defaultChecked={area?.deliveryAvailable ?? false}
        />
        <CheckboxField
          name="isPublished"
          label="Show on the website"
          hint="List it on the Delivery Areas page and in the order form."
          defaultChecked={area?.isPublished ?? false}
        />
      </section>

      <section className="space-y-5">
        <h2 className="text-base font-semibold">Delivery details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Delivery fee (optional)" name="deliveryFeeCents" hint="Leave blank if you don't charge a fee or haven't confirmed one.">
            {(id) => <MoneyInput id={id} name="deliveryFee" defaultCents={area?.deliveryFeeCents} />}
          </Field>
          <Field label="Minimum order (optional)" name="minOrderCents" hint="Leave blank for no minimum.">
            {(id) => <MoneyInput id={id} name="minOrder" defaultCents={area?.minOrderCents} />}
          </Field>
        </div>
        <WeekdayCheckboxes name="deliveryDays" legend="Delivery days" defaultValue={area?.deliveryDays} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Delivery time window (optional)" name="deliveryWindow" hint="e.g. Evenings, 18:00–21:00">
            {(id) => <Input id={id} name="deliveryWindow" defaultValue={area?.deliveryWindow ?? ""} maxLength={120} />}
          </Field>
          <Field label="Zone (optional)" name="zone" hint="Your own grouping, e.g. North, Central. Not shown to customers.">
            {(id) => <Input id={id} name="zone" defaultValue={area?.zone ?? ""} maxLength={60} />}
          </Field>
        </div>
        <Field label="Notes for customers (optional)" name="notes" hint="e.g. Delivery to the Valletta ferry area only.">
          {(id) => <Textarea id={id} name="notes" defaultValue={area?.notes ?? ""} rows={3} maxLength={600} />}
        </Field>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <input
            id="hasPublicPage"
            type="checkbox"
            name="hasPublicPage"
            checked={publicPage}
            onChange={(e) => setPublicPage(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-ink"
          />
          <label htmlFor="hasPublicPage" className="text-sm">
            <span className="font-medium">Give this locality its own page on Google</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Optional. Only do this when you have genuinely useful, local information — such as your delivery schedule here, a
              collection option nearby, or answers to questions customers in this area ask. Pages that just repeat the same text with
              a different town name can hurt your Google rankings (Google calls them &quot;doorway pages&quot;). Most businesses only need
              the single Delivery Areas page.
            </span>
          </label>
        </div>
        <FieldError name="hasPublicPage" />
        {publicPage && (
          <div className="space-y-5">
            <Field label="Introduction" name="pageIntro" required hint="One or two sentences shown at the top of the page.">
              {(id) => <Textarea id={id} name="pageIntro" defaultValue={area?.pageIntro ?? ""} rows={2} maxLength={600} />}
            </Field>
            <Field
              label="Page content"
              name="pageBody"
              required
              hint={`At least ${MIN_WORDS} words specific to ${name || "this locality"}. Leave a blank line between paragraphs.`}
            >
              {(id) => (
                <Textarea id={id} name="pageBody" value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={12000} />
              )}
            </Field>
            <p className={count >= MIN_WORDS ? "text-xs text-emerald-700" : "text-xs text-muted-foreground"}>
              {count} / {MIN_WORDS} words
            </p>
          </div>
        )}
        {!publicPage && <input type="hidden" name="pageBody" value={body} />}
        {!publicPage && <input type="hidden" name="pageIntro" value={area?.pageIntro ?? ""} />}
      </section>

      <FormActions>
        <SubmitButton>{area ? "Save locality" : "Add locality"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
