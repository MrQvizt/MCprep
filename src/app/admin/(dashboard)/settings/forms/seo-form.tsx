"use client";

import Link from "next/link";
import { AdminForm, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SettingsOf } from "@/lib/settings/schema";
import { saveSettingsSection } from "../actions";

export function SeoDefaultsForm({ values }: { values: SettingsOf<"seo"> }) {
  return (
    <AdminForm action={saveSettingsSection.bind(null, "seo")} className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Fallbacks used when a page has no SEO text of its own. Edit individual pages in{" "}
        <Link href="/admin/seo" className="font-medium underline underline-offset-4">
          SEO &amp; Google visibility
        </Link>
        ; Search Console verification lives in{" "}
        <Link href="/admin/listings" className="font-medium underline underline-offset-4">
          Google &amp; listings
        </Link>
        .
      </p>
      <Field label="Brand name added to page titles" name="titleSuffix" required hint="e.g. MC PREPS Malta">
        {(id) => <Input id={id} name="titleSuffix" defaultValue={values.titleSuffix} maxLength={60} className="max-w-sm" />}
      </Field>
      <Field label="Default description" name="defaultDescription" required hint="About 120–155 characters. Describe what you offer and where.">
        {(id) => <Textarea id={id} name="defaultDescription" defaultValue={values.defaultDescription} rows={3} maxLength={300} />}
      </Field>
      <FormActions>
        <SubmitButton>Save search defaults</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
