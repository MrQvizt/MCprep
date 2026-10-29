"use client";

import { AdminForm, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { Input } from "@/components/ui/input";
import type { SettingsOf } from "@/lib/settings/schema";
import { saveSettingsSection } from "../actions";

export function BrandingForm({
  values,
  media,
}: {
  values: SettingsOf<"branding">;
  media: Record<string, PickedMedia | null>;
}) {
  return (
    <AdminForm action={saveSettingsSection.bind(null, "branding")} className="space-y-8">
      <Field
        label="Text logo"
        name="logoText"
        required
        hint="Shown as the logo until you upload your MC monogram. The first word becomes the white block, e.g. “MC PREPS”."
      >
        {(id) => <Input id={id} name="logoText" defaultValue={values.logoText} maxLength={40} className="max-w-xs" />}
      </Field>
      <div className="grid gap-8 lg:grid-cols-2">
        <MediaPicker
          name="logoMediaId"
          label="Main logo"
          category="BRANDING"
          aspect="aspect-[3/1]"
          defaultValue={media.logo}
          hint="White logo on a transparent background (PNG), at least 600 px wide. Shown in the header and footer on black."
        />
        <MediaPicker
          name="logoAltMediaId"
          label="Alternate logo"
          category="BRANDING"
          aspect="aspect-[3/1]"
          defaultValue={media.logoAlt}
          hint="Dark version for light backgrounds (PNG)."
        />
        <MediaPicker
          name="faviconMediaId"
          label="Favicon (browser tab icon)"
          category="BRANDING"
          aspect="aspect-square"
          defaultValue={media.favicon}
          hint="Square PNG, at least 512 × 512 px — e.g. the MC monogram on black."
        />
        <MediaPicker
          name="socialShareMediaId"
          label="Social sharing image"
          category="SOCIAL"
          aspect="aspect-[1.91/1]"
          defaultValue={media.share}
          hint="Shown when links are shared on WhatsApp, Facebook, LinkedIn… Use 1200 × 630 px. Without it, a black MC PREPS card is generated."
        />
      </div>
      <FormActions>
        <SubmitButton>Save branding</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
