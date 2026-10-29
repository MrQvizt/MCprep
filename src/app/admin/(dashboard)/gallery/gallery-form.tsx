"use client";

import { AdminForm, CheckboxField, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveGalleryItem } from "./actions";

export interface GalleryFormValues {
  id: string;
  media: PickedMedia;
  caption: string | null;
  altText: string | null;
  instagramUrl: string | null;
  isPublished: boolean;
  isFeatured: boolean;
}

export function GalleryForm({ item, profileUrl }: { item?: GalleryFormValues; profileUrl: string }) {
  return (
    <AdminForm action={saveGalleryItem.bind(null, item?.id ?? null)} className="max-w-3xl space-y-6">
      <MediaPicker name="mediaAssetId" label="Photo" category="GALLERY" defaultValue={item?.media ?? null} aspect="aspect-square" hint="Square photos look best." />
      <Field label="Instagram post link (optional)" name="instagramUrl" hint={`Paste the post's link. Leave empty to link to your profile (${profileUrl}).`}>
        {(id) => <Input id={id} name="instagramUrl" type="url" defaultValue={item?.instagramUrl ?? ""} placeholder="https://www.instagram.com/p/…" />}
      </Field>
      <Field label="Description (alt text)" name="altText" hint="What's in the photo? Leave empty to use the image's own description.">
        {(id) => <Input id={id} name="altText" defaultValue={item?.altText ?? ""} maxLength={300} />}
      </Field>
      <Field label="Caption (optional)" name="caption">
        {(id) => <Textarea id={id} name="caption" defaultValue={item?.caption ?? ""} rows={2} maxLength={300} />}
      </Field>
      <div className="space-y-3 rounded-lg border p-4">
        <CheckboxField name="isPublished" label="Show on the website" defaultChecked={item?.isPublished ?? true} />
        <CheckboxField name="isFeatured" label="Show on the homepage" hint="The homepage shows a selection; the gallery page shows all published photos." defaultChecked={item?.isFeatured ?? true} />
      </div>
      <FormActions>
        <SubmitButton>{item ? "Save photo" : "Add to gallery"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
