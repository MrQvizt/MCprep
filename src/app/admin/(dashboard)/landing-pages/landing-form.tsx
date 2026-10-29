"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/page-header";
import { AdminForm, CheckboxField, Field, FormActions, NativeSelect, SubmitButton } from "@/components/admin/form";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/urls";
import { saveLandingPage } from "./actions";

export interface LandingFormValues {
  id: string;
  type: string;
  title: string;
  slug: string;
  headline: string;
  subheadline: string | null;
  body: string | null;
  ctaText: string;
  heroImage: PickedMedia | null;
  promotionId: string | null;
  planIds: string[];
  utmCampaign: string | null;
  isPublished: boolean;
  noindex: boolean;
  expiredBehavior: string;
  expiredMessage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: PickedMedia | null;
}

export function LandingForm({
  page,
  promotions,
  plans,
  types,
  expiredOptions,
}: {
  page?: LandingFormValues;
  promotions: { id: string; name: string; state: string }[];
  plans: { id: string; name: string }[];
  types: Record<string, string>;
  expiredOptions: Record<string, string>;
}) {
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [touched, setTouched] = useState(Boolean(page));
  const slugChanged = page ? slug !== page.slug : false;
  return (
    <AdminForm action={saveLandingPage.bind(null, page?.id ?? null)} className="space-y-6">
      <AdminCard title="Page">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Internal title" name="title" required hint="For you, e.g. Halloween 2026">
            {(id) => (
              <Input id={id} name="title" defaultValue={page?.title} maxLength={100} onChange={(e) => !touched && setSlug(slugify(e.target.value))} />
            )}
          </Field>
          <Field label="Page address" name="slug" required hint={`/offers/${slug || "…"}`}>
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
          <Field label="Type" name="type">
            {(id) => (
              <NativeSelect id={id} name="type" defaultValue={page?.type ?? "SEASONAL"}>
                {Object.entries(types).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Campaign tag for tracking (optional)" name="utmCampaign" hint="Added to links from this page so you can see which orders it brings in, e.g. halloween">
            {(id) => <Input id={id} name="utmCampaign" defaultValue={page?.utmCampaign ?? ""} maxLength={60} />}
          </Field>
        </div>
        {slugChanged && page?.isPublished && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <CheckboxField
              name="createRedirect"
              defaultChecked
              label="Redirect the old address to the new one (recommended)"
              hint={`Keeps links to /offers/${page.slug} working (for example in ads or posts you've shared).`}
            />
          </div>
        )}
      </AdminCard>

      <AdminCard title="Content">
        <div className="grid gap-5">
          <Field label="Headline" name="headline" required>
            {(id) => <Input id={id} name="headline" defaultValue={page?.headline ?? ""} maxLength={140} />}
          </Field>
          <Field label="Subheadline (optional)" name="subheadline">
            {(id) => <Input id={id} name="subheadline" defaultValue={page?.subheadline ?? ""} maxLength={200} />}
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Page text</p>
            <RichTextEditor name="body" defaultValue={page?.body ?? ""} minHeight={200} imageCategory="PROMOTION" placeholder="Explain the offer and how to claim it…" />
          </div>
          <Field label="Button text" name="ctaText" required>
            {(id) => <Input id={id} name="ctaText" defaultValue={page?.ctaText ?? "Claim your first-order offer"} maxLength={50} />}
          </Field>
          <MediaPicker name="heroImageId" label="Hero photo (optional)" category="PROMOTION" defaultValue={page?.heroImage ?? null} aspect="aspect-video" />
        </div>
      </AdminCard>

      <AdminCard title="Offer & plans" description="Link a promotion to show its countdown and discounted prices on this page.">
        <div className="grid gap-5">
          <Field label="Promotion" name="promotionId">
            {(id) => (
              <NativeSelect id={id} name="promotionId" defaultValue={page?.promotionId ?? ""}>
                <option value="">No promotion</option>
                {promotions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.state})
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Plans to show (leave all unticked to show every available plan)</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {plans.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="planIds" value={p.id} defaultChecked={page?.planIds.includes(p.id)} className="size-4 accent-ink" />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="When the linked offer ends" name="expiredBehavior" hint="Discounts always stop at the promotion's end time.">
            {(id) => (
              <NativeSelect id={id} name="expiredBehavior" defaultValue={page?.expiredBehavior ?? "SHOW_EXPIRED_MESSAGE"}>
                {Object.entries(expiredOptions).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Ended message" name="expiredMessage">
            {(id) => (
              <Textarea
                id={id}
                name="expiredMessage"
                defaultValue={page?.expiredMessage ?? "This offer has ended. Follow us on Instagram to hear about the next one."}
                rows={2}
                maxLength={400}
              />
            )}
          </Field>
        </div>
      </AdminCard>

      <AdminCard title="Google & sharing">
        <div className="space-y-5">
          <CheckboxField
            name="noindex"
            defaultChecked={page?.noindex ?? true}
            label="Hide this page from Google (recommended for short campaigns and ads)"
            hint="Temporary offer pages that look alike can compete with your main pages in Google. Visitors with the link can still see it."
          />
          <Field label="SEO title (optional)" name="seoTitle">
            {(id) => <Input id={id} name="seoTitle" defaultValue={page?.seoTitle ?? ""} maxLength={70} />}
          </Field>
          <Field label="SEO / sharing description (optional)" name="seoDescription">
            {(id) => <Textarea id={id} name="seoDescription" defaultValue={page?.seoDescription ?? ""} rows={2} maxLength={170} />}
          </Field>
          <MediaPicker name="ogImageId" label="Sharing image (optional)" category="SOCIAL" defaultValue={page?.ogImage ?? null} aspect="aspect-[1.91/1]" hint="Shown when the link is shared on WhatsApp, Facebook, etc. 1200×630 works best." />
        </div>
      </AdminCard>

      <AdminCard title="Publish">
        <CheckboxField name="isPublished" label="Published" hint="Unpublished pages show “page not found”." defaultChecked={page?.isPublished ?? false} />
      </AdminCard>

      <FormActions>
        <SubmitButton>{page ? "Save page" : "Create page"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
