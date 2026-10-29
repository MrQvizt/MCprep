"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { AdminForm, CheckboxField, Field, FormActions, SubmitButton, useFormState } from "@/components/admin/form";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { CharacterCount, SerpPreview, SocialPreview, LENGTHS } from "@/components/admin/seo/serp-preview";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resetSeoPage, saveSeoPage } from "../actions";

export interface SeoPageFormProps {
  pageKey: string;
  path: string;
  absoluteUrl: string;
  siteName: string;
  domain: string;
  important: boolean;
  defaults: { title: string; description: string; primaryTopic: string; breadcrumb: string };
  values: {
    title: string;
    description: string;
    primaryTopic: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: PickedMedia | null;
    indexable: boolean;
    canonicalUrl: string;
    breadcrumbLabel: string;
  };
  defaultShareImageUrl: string | null;
  hasOverrides: boolean;
}

function NoindexWarning({ important }: { important: boolean }) {
  const state = useFormState();
  if (!important) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-semibold">This is one of your most important pages.</p>
      <p className="mt-1">Hiding it from Google means people searching for meal prep in Malta won&apos;t find it.</p>
      <div className="mt-3">
        <CheckboxField name="confirmNoindex" label="Yes, hide this page from Google" />
        {state.fieldErrors?.confirmNoindex && <p className="mt-1 text-xs font-medium text-destructive">{state.fieldErrors.confirmNoindex}</p>}
      </div>
    </div>
  );
}

export function SeoPageForm(props: SeoPageFormProps) {
  const { values, defaults } = props;
  const [title, setTitle] = useState(values.title);
  const [description, setDescription] = useState(values.description);
  const [ogTitle, setOgTitle] = useState(values.ogTitle);
  const [ogDescription, setOgDescription] = useState(values.ogDescription);
  const [ogImage, setOgImage] = useState<PickedMedia | null>(values.ogImage);
  const [indexable, setIndexable] = useState(values.indexable);

  const effectiveTitle = title.trim() || defaults.title;
  const effectiveDescription = description.trim() || defaults.description;

  return (
    <AdminForm action={saveSeoPage.bind(null, props.pageKey)} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-8">
        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold">How this page appears in Google</h2>
            <p className="mt-1 text-sm text-muted-foreground">Leave a field empty to use the recommended default shown in grey.</p>
          </div>
          <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Page address: </span>
            <code className="font-medium">{props.path}</code>
            <p className="mt-1 text-xs text-muted-foreground">
              Core page addresses are fixed to protect your Google rankings. To send an old or extra address here, add a redirect.
            </p>
          </div>
          <Field label="Google title" name="title" hint={<CharacterCount value={effectiveTitle} max={LENGTHS.TITLE_RECOMMENDED_MAX} label="Length" />}>
            {(id) => <Input id={id} name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaults.title} maxLength={120} />}
          </Field>
          <Field
            label="SEO description"
            name="description"
            hint={<CharacterCount value={effectiveDescription} min={LENGTHS.DESCRIPTION_RECOMMENDED_MIN} max={LENGTHS.DESCRIPTION_RECOMMENDED_MAX} label="Length" />}
          >
            {(id) => (
              <Textarea id={id} name="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={defaults.description} rows={3} maxLength={320} />
            )}
          </Field>
          <Field label="Main search topic" name="primaryTopic" hint="The search this page should be found for, e.g. “meal prep Malta”. Used for your own planning and link suggestions — it isn't shown to visitors.">
            {(id) => <Input id={id} name="primaryTopic" defaultValue={values.primaryTopic} placeholder={defaults.primaryTopic} maxLength={120} />}
          </Field>
          <Field label="Breadcrumb label" name="breadcrumbLabel" hint="Short name shown in the “Home › …” trail.">
            {(id) => <Input id={id} name="breadcrumbLabel" defaultValue={values.breadcrumbLabel} placeholder={defaults.breadcrumb} maxLength={60} />}
          </Field>
        </section>

        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <div>
            <h2 className="text-base font-semibold">Sharing on WhatsApp, Facebook & Instagram</h2>
            <p className="mt-1 text-sm text-muted-foreground">What people see when this page is shared. Defaults to the Google title and description.</p>
          </div>
          <Field label="Social title" name="ogTitle">
            {(id) => <Input id={id} name="ogTitle" value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} placeholder={effectiveTitle} maxLength={120} />}
          </Field>
          <Field label="Social description" name="ogDescription">
            {(id) => (
              <Textarea id={id} name="ogDescription" value={ogDescription} onChange={(e) => setOgDescription(e.target.value)} placeholder={effectiveDescription} rows={2} maxLength={320} />
            )}
          </Field>
          <MediaPicker
            name="ogImageId"
            label="Sharing image"
            category="SOCIAL"
            aspect="aspect-[1.91/1]"
            defaultValue={values.ogImage}
            onChange={setOgImage}
            hint="1200 × 630 pixels works best. Leave empty to use your default sharing image."
          />
        </section>

        <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">Indexing</h2>
          <div className="flex items-start gap-3">
            <input
              id="indexable"
              type="checkbox"
              name="indexable"
              checked={indexable}
              onChange={(e) => setIndexable(e.target.checked)}
              className="mt-0.5 size-4 accent-ink"
            />
            <label htmlFor="indexable" className="text-sm">
              <span className="font-medium">Show this page in Google</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                When unticked, the page stays on your website but asks search engines not to list it, and it is removed from the sitemap.
              </span>
            </label>
          </div>
          {!indexable && <NoindexWarning important={props.important} />}
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-medium">Advanced: canonical URL</summary>
            <div className="mt-4">
              <Field
                label="Canonical URL"
                name="canonicalUrl"
                hint="Only if this page duplicates another one. Tells Google which address is the main version. Leave empty in almost every case."
              >
                {(id) => <Input id={id} name="canonicalUrl" defaultValue={values.canonicalUrl} placeholder={props.path} maxLength={500} />}
              </Field>
            </div>
          </details>
        </section>

        <FormActions>
          <SubmitButton>Save SEO settings</SubmitButton>
          {props.hasOverrides && (
            <ConfirmAction
              action={resetSeoPage.bind(null, props.pageKey)}
              title="Restore the default SEO settings?"
              description="Your custom title, description, sharing settings and indexing choice for this page will be removed."
              confirmLabel="Restore defaults"
              variant="ghost"
            >
              <RotateCcw className="size-4" /> Restore defaults
            </ConfirmAction>
          )}
        </FormActions>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Google preview</p>
          <SerpPreview title={effectiveTitle} description={effectiveDescription} url={props.absoluteUrl} siteName={props.siteName} />
          {!indexable && <p className="text-xs font-medium text-red-700">This page is hidden from Google.</p>}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Sharing preview</p>
          <SocialPreview
            title={ogTitle.trim() || effectiveTitle}
            description={ogDescription.trim() || effectiveDescription}
            imageUrl={ogImage?.url ?? props.defaultShareImageUrl}
            domain={props.domain}
          />
        </div>
      </aside>
    </AdminForm>
  );
}
