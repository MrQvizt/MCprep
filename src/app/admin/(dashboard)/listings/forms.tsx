"use client";

import { AdminForm, Field, FormActions, NativeSelect, SubmitButton } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveGoogleProfile, saveListing, saveSearchConsole } from "./actions";

export const LISTING_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  SUBMITTED: "Submitted",
  PENDING_VERIFICATION: "Waiting for verification",
  VERIFIED: "Verified",
  NEEDS_UPDATE: "Needs updating",
  REJECTED: "Rejected",
};

export function GoogleProfileForm({ profileUrl, reviewUrl }: { profileUrl: string; reviewUrl: string }) {
  return (
    <AdminForm action={saveGoogleProfile} className="space-y-4">
      <Field label="Google Business Profile link" name="googleBusinessProfileUrl" hint="Open your profile on Google Maps → Share → copy link. Shown as “Find us on Google” in the footer.">
        {(id) => <Input id={id} name="googleBusinessProfileUrl" defaultValue={profileUrl} placeholder="https://maps.app.goo.gl/…" />}
      </Field>
      <Field label="Review link" name="googleReviewUrl" hint="In your Business Profile choose “Ask for reviews” and copy the link. Share it with every customer — not only happy ones.">
        {(id) => <Input id={id} name="googleReviewUrl" defaultValue={reviewUrl} placeholder="https://g.page/r/…/review" />}
      </Field>
      <SubmitButton>Save links</SubmitButton>
    </AdminForm>
  );
}

export function SearchConsoleForm({ google, bing, property }: { google: string; bing: string; property: string }) {
  return (
    <AdminForm action={saveSearchConsole} className="space-y-4">
      <Field
        label="Google verification code"
        name="googleSiteVerification"
        hint={<>In Search Console choose the <strong>HTML tag</strong> method and paste the whole tag (or just the code). Then click Verify in Search Console.</>}
      >
        {(id) => <Input id={id} name="googleSiteVerification" defaultValue={google} placeholder={'<meta name="google-site-verification" content="…" />'} className="font-mono text-xs" />}
      </Field>
      <Field label="Bing verification code (optional)" name="bingSiteVerification" hint="From Bing Webmaster Tools → meta tag option. You can also import your site from Search Console.">
        {(id) => <Input id={id} name="bingSiteVerification" defaultValue={bing} placeholder={'<meta name="msvalidate.01" content="…" />'} className="font-mono text-xs" />}
      </Field>
      <Field label="Verified Search Console property" name="searchConsolePropertyUrl" hint="For your records, e.g. https://www.yourdomain.com/ or sc-domain:yourdomain.com">
        {(id) => <Input id={id} name="searchConsolePropertyUrl" defaultValue={property} />}
      </Field>
      <SubmitButton>Save verification</SubmitButton>
    </AdminForm>
  );
}

export interface ListingValues {
  id: string;
  platform: string;
  url: string | null;
  status: string;
  submittedAt: string;
  lastCheckedAt: string;
  detailsUsed: string | null;
  notes: string | null;
}

export function ListingForm({ listing, defaultDetails }: { listing?: ListingValues; defaultDetails: string }) {
  return (
    <AdminForm action={saveListing.bind(null, listing?.id ?? null)} className="max-w-3xl space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Platform" name="platform" required hint="e.g. Google Business Profile, Bing Places, a Malta business directory">
          {(id) => <Input id={id} name="platform" defaultValue={listing?.platform} maxLength={80} />}
        </Field>
        <Field label="Status" name="status" hint="Only choose “Verified” once the platform has confirmed it.">
          {(id) => (
            <NativeSelect id={id} name="status" defaultValue={listing?.status ?? "NOT_STARTED"}>
              {Object.entries(LISTING_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>
      <Field label="Listing link" name="url">
        {(id) => <Input id={id} name="url" defaultValue={listing?.url ?? ""} placeholder="https://…" />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Submitted on" name="submittedAt">
          {(id) => <Input id={id} type="date" name="submittedAt" defaultValue={listing?.submittedAt} className="max-w-48" />}
        </Field>
        <Field label="Last checked on" name="lastCheckedAt">
          {(id) => <Input id={id} type="date" name="lastCheckedAt" defaultValue={listing?.lastCheckedAt} className="max-w-48" />}
        </Field>
      </div>
      <Field label="Business details used" name="detailsUsed" hint="Copy exactly what you entered (name, phone, address, website) so you can keep listings consistent.">
        {(id) => <Textarea id={id} name="detailsUsed" defaultValue={listing?.detailsUsed ?? defaultDetails} rows={4} maxLength={1000} />}
      </Field>
      <Field label="Notes" name="notes">
        {(id) => <Textarea id={id} name="notes" defaultValue={listing?.notes ?? ""} rows={3} maxLength={1000} />}
      </Field>
      <FormActions>
        <SubmitButton>{listing ? "Save listing" : "Add listing"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
