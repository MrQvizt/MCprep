"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/page-header";
import { AdminForm, CheckboxField, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { MoneyInput } from "@/components/admin/inputs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/urls";
import { savePlan } from "./actions";

export interface PlanFormValues {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  durationDays: number;
  mealsIncluded: number | null;
  features: string[];
  priceCents: number | null;
  savingsLabel: string | null;
  isRecommended: boolean;
  isActive: boolean;
}

export function PlanForm({ plan, orderCount = 0 }: { plan?: PlanFormValues; orderCount?: number }) {
  const [slug, setSlug] = useState(plan?.slug ?? "");
  const [touched, setTouched] = useState(Boolean(plan));
  return (
    <AdminForm action={savePlan.bind(null, plan?.id ?? null)} className="space-y-6">
      <AdminCard title="Plan">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Plan name" name="name" required hint="e.g. 1 Week, 2 Weeks, 1 Month">
            {(id) => (
              <Input
                id={id}
                name="name"
                defaultValue={plan?.name}
                maxLength={60}
                onChange={(e) => !touched && setSlug(slugify(e.target.value))}
              />
            )}
          </Field>
          <Field label="Short code" name="slug" required hint="Used in order links, e.g. /order?plan=2-weeks">
            {(id) => (
              <Input
                id={id}
                name="slug"
                value={slug}
                maxLength={80}
                onChange={(e) => {
                  setTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
              />
            )}
          </Field>
          <Field label="Tagline (optional)" name="tagline" hint="e.g. Starter, Popular, Commitment">
            {(id) => <Input id={id} name="tagline" defaultValue={plan?.tagline ?? ""} maxLength={40} />}
          </Field>
          <Field label="Length in days" name="durationDays" required>
            {(id) => <Input id={id} name="durationDays" inputMode="numeric" defaultValue={plan?.durationDays ?? 7} />}
          </Field>
          <Field label="Meals included (optional)" name="mealsIncluded" hint="Leave empty if it varies.">
            {(id) => <Input id={id} name="mealsIncluded" inputMode="numeric" defaultValue={plan?.mealsIncluded ?? ""} />}
          </Field>
        </div>
        <div className="mt-5 grid gap-5">
          <Field label="Description" name="description">
            {(id) => <Textarea id={id} name="description" defaultValue={plan?.description ?? ""} rows={2} maxLength={400} />}
          </Field>
          <Field label="What's included" name="features" hint="One item per line. Shown as ticks on the pricing card.">
            {(id) => <Textarea id={id} name="features" defaultValue={plan?.features.join("\n") ?? ""} rows={5} />}
          </Field>
        </div>
      </AdminCard>

      <AdminCard
        title="Price"
        description={
          orderCount > 0
            ? `Existing orders keep the price they were quoted — changing it only affects new order requests (${orderCount} order(s) use this plan).`
            : "Existing orders always keep the price they were quoted."
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Price (EUR)" name="priceCents" hint="Leave empty to show “price confirmed with you” instead of a price.">
            {(id) => <MoneyInput id={id} name="price" defaultCents={plan?.priceCents ?? null} />}
          </Field>
          <Field label="Savings label (optional)" name="savingsLabel" hint="e.g. Best value. Only use claims that are true.">
            {(id) => <Input id={id} name="savingsLabel" defaultValue={plan?.savingsLabel ?? ""} maxLength={40} />}
          </Field>
        </div>
      </AdminCard>

      <AdminCard title="Visibility">
        <div className="space-y-3">
          <CheckboxField name="isActive" label="Available to order" hint="Hidden plans don't appear on the website or the order form." defaultChecked={plan?.isActive ?? true} />
          <CheckboxField
            name="isRecommended"
            label="Highlight as recommended"
            hint="Only one plan can be recommended — this replaces the current one."
            defaultChecked={plan?.isRecommended ?? false}
          />
        </div>
      </AdminCard>

      <FormActions>
        <SubmitButton>{plan ? "Save plan" : "Create plan"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
