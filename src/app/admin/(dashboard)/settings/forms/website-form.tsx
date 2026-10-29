"use client";

import { AdminForm, CheckboxField, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import type { SettingsOf } from "@/lib/settings/schema";
import { saveSettingsSection } from "../actions";

export function WebsiteForm({ values }: { values: SettingsOf<"site"> }) {
  return (
    <AdminForm action={saveSettingsSection.bind(null, "website")} className="space-y-8">
      <section className="space-y-4 rounded-lg border p-4">
        <CheckboxField
          name="showDemoNotice"
          label="Show the “preview site” notice"
          hint="A thin white bar at the top of every page. Switch it off once your real prices, photos and details are in place."
          defaultChecked={values.showDemoNotice}
        />
        <Field label="Notice text" name="demoNoticeText">
          {(id) => <Input id={id} name="demoNoticeText" defaultValue={values.demoNoticeText} maxLength={200} />}
        </Field>
      </section>
      <section className="space-y-4">
        <h3 className="text-base font-semibold">Announcement bar (optional)</h3>
        <p className="text-sm text-muted-foreground">A short message above the menu, e.g. “Orders for next week close on Friday”. Leave empty to hide.</p>
        <Field label="Announcement" name="announcementText">
          {(id) => <Input id={id} name="announcementText" defaultValue={values.announcementText} maxLength={160} />}
        </Field>
        <Field label="Link (optional)" name="announcementHref" hint="A page on your site such as /offers, or a full https:// link.">
          {(id) => <Input id={id} name="announcementHref" defaultValue={values.announcementHref} maxLength={300} />}
        </Field>
      </section>
      <FormActions>
        <SubmitButton>Save website notices</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
