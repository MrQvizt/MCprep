"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/page-header";
import { AdminForm, CheckboxField, Field, FieldError, FormActions, NativeSelect, SubmitButton } from "@/components/admin/form";
import { MoneyInput } from "@/components/admin/inputs";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { basisPointsToPercentLabel } from "@/lib/money";
import { utcToZonedInputValue, zonedLocalToUtc } from "@/lib/time";
import { slugify } from "@/lib/urls";
import { savePromotion } from "./actions";

export interface PromotionFormValues {
  id: string;
  name: string;
  slug: string;
  theme: string;
  headline: string;
  subheadline: string | null;
  description: string | null;
  badgeText: string | null;
  ctaText: string;
  image: PickedMedia | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountCents: number | null;
  audience: "ALL_CUSTOMERS" | "NEW_CUSTOMERS" | "SELECTED_CUSTOMERS";
  requiresCode: boolean;
  code: string | null;
  appliesToAllPlans: boolean;
  planIds: string[];
  startsAt: string; // ISO
  endsAt: string; // ISO
  isEnabled: boolean;
  showCountdown: boolean;
  showOnHomepage: boolean;
  priority: number;
  totalRedemptionLimit: number | null;
  perCustomerLimit: number | null;
  terms: string | null;
  expiredBehavior: "HIDE" | "SHOW_ENDED_MESSAGE";
  expiredMessage: string | null;
  selectedEmails: string[];
}

function durationLabel(start: string, end: string, tz: string) {
  const s = zonedLocalToUtc(start, tz);
  const e = zonedLocalToUtc(end, tz);
  if (!s || !e) return null;
  const ms = e.getTime() - s.getTime();
  if (ms <= 0) return { text: "The end must be after the start.", warn: true };
  const hours = Math.round(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const text = `Runs for ${days > 0 ? `${days} day${days === 1 ? "" : "s"}` : ""}${days > 0 && rest > 0 ? " " : ""}${rest > 0 || days === 0 ? `${rest} hour${rest === 1 ? "" : "s"}` : ""}.`;
  return { text, warn: false };
}

export function PromotionForm({
  promotion,
  plans,
  themes,
  audiences,
  timeZone,
}: {
  promotion?: PromotionFormValues;
  plans: { id: string; name: string; isActive: boolean }[];
  themes: Record<string, string>;
  audiences: Record<string, string>;
  timeZone: string;
}) {
  const [slug, setSlug] = useState(promotion?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(promotion));
  const [discountType, setDiscountType] = useState(promotion?.discountType ?? "PERCENTAGE");
  const [audience, setAudience] = useState(promotion?.audience ?? "NEW_CUSTOMERS");
  const [requiresCode, setRequiresCode] = useState(promotion?.requiresCode ?? false);
  const [planScope, setPlanScope] = useState(promotion && !promotion.appliesToAllPlans ? "selected" : "all");
  const [startsAt, setStartsAt] = useState(promotion ? utcToZonedInputValue(new Date(promotion.startsAt), timeZone) : "");
  const [endsAt, setEndsAt] = useState(promotion ? utcToZonedInputValue(new Date(promotion.endsAt), timeZone) : "");
  const [endDate, setEndDate] = useState("");
  const [expiredBehavior, setExpiredBehavior] = useState(promotion?.expiredBehavior ?? "HIDE");
  const codeRequired = requiresCode || audience === "SELECTED_CUSTOMERS";
  const duration = startsAt && endsAt ? durationLabel(startsAt, endsAt, timeZone) : null;
  const nowLocal = () => utcToZonedInputValue(new Date(Math.ceil(Date.now() / 60_000) * 60_000), timeZone);

  return (
    <AdminForm action={savePromotion.bind(null, promotion?.id ?? null)} className="space-y-6">
      <AdminCard title="Campaign">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Campaign name" name="name" required hint="For you — e.g. MC PREPS Halloween Special">
            {(id) => (
              <Input
                id={id}
                name="name"
                defaultValue={promotion?.name}
                maxLength={100}
                onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
              />
            )}
          </Field>
          <Field label="Short code" name="slug" required hint="Used in links and reports, e.g. halloween-2026">
            {(id) => (
              <Input
                id={id}
                name="slug"
                value={slug}
                maxLength={80}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
              />
            )}
          </Field>
          <Field label="Occasion / theme" name="theme" hint="Adds a subtle seasonal accent to the badge only.">
            {(id) => (
              <NativeSelect id={id} name="theme" defaultValue={promotion?.theme ?? "NONE"}>
                {Object.entries(themes).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Badge (optional)" name="badgeText" hint="Small label, e.g. Halloween special">
            {(id) => <Input id={id} name="badgeText" defaultValue={promotion?.badgeText ?? ""} maxLength={40} />}
          </Field>
        </div>
      </AdminCard>

      <AdminCard
        title="What customers see"
        description={
          <>
            Tip: write <code className="rounded bg-muted px-1">{"{discount}"}</code> to insert the discount (e.g. 20%) and{" "}
            <code className="rounded bg-muted px-1">{"{ends}"}</code> for the end date, so the text always matches your settings.
          </>
        }
      >
        <div className="grid gap-5">
          <Field label="Headline" name="headline" required>
            {(id) => <Input id={id} name="headline" defaultValue={promotion?.headline ?? ""} maxLength={120} placeholder="e.g. Halloween fuel deal" />}
          </Field>
          <Field label="Subheadline (optional)" name="subheadline">
            {(id) => <Input id={id} name="subheadline" defaultValue={promotion?.subheadline ?? ""} maxLength={160} />}
          </Field>
          <Field label="Description (optional)" name="description">
            {(id) => (
              <Textarea
                id={id}
                name="description"
                defaultValue={promotion?.description ?? ""}
                rows={3}
                maxLength={600}
                placeholder="Get {discount} off your first meal plan when you order before the countdown ends."
              />
            )}
          </Field>
          <Field label="Button text" name="ctaText" required>
            {(id) => <Input id={id} name="ctaText" defaultValue={promotion?.ctaText ?? "Claim your offer"} maxLength={40} />}
          </Field>
          <MediaPicker name="imageId" label="Background photo (optional)" category="PROMOTION" defaultValue={promotion?.image ?? null} aspect="aspect-video" />
        </div>
      </AdminCard>

      <AdminCard title="Discount" description="Discounts are always calculated by the website's server — never in the visitor's browser.">
        <fieldset className="flex flex-wrap gap-4">
          <legend className="sr-only">Discount type</legend>
          {(
            [
              ["PERCENTAGE", "Percentage off"],
              ["FIXED_AMOUNT", "Fixed amount off"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="discountType"
                value={value}
                checked={discountType === value}
                onChange={() => setDiscountType(value)}
                className="size-4 accent-ink"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {discountType === "PERCENTAGE" ? (
            <>
              <Field label="Discount (%)" name="discountPercent" required>
                {(id) => (
                  <div className="relative">
                    <Input
                      id={id}
                      name="discountPercent"
                      inputMode="decimal"
                      defaultValue={promotion?.discountType === "PERCENTAGE" ? basisPointsToPercentLabel(promotion.discountValue) : ""}
                      className="pr-8"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
                  </div>
                )}
              </Field>
              <Field label="Maximum discount (optional)" name="maxDiscountCents" hint="Caps the discount on expensive plans.">
                {(id) => <MoneyInput id={id} name="maxDiscount" defaultCents={promotion?.maxDiscountCents ?? null} />}
              </Field>
            </>
          ) : (
            <Field label="Amount off (EUR)" name="discountAmount" required>
              {(id) => (
                <MoneyInput id={id} name="discountAmount" defaultCents={promotion?.discountType === "FIXED_AMOUNT" ? promotion.discountValue : null} />
              )}
            </Field>
          )}
        </div>
        <fieldset className="mt-6">
          <legend className="mb-2 text-sm font-medium">Which plans?</legend>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ["all", "All plans"],
                ["selected", "Only selected plans"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="radio" name="planScope" value={value} checked={planScope === value} onChange={() => setPlanScope(value)} className="size-4 accent-ink" />
                {label}
              </label>
            ))}
          </div>
          {planScope === "selected" && (
            <div className="mt-3 space-y-1.5">
              <div className="grid gap-2 sm:grid-cols-3">
                {plans.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="planIds" value={p.id} defaultChecked={promotion?.planIds.includes(p.id)} className="size-4 accent-ink" />
                    {p.name}
                    {!p.isActive && <span className="text-xs text-muted-foreground">(hidden)</span>}
                  </label>
                ))}
              </div>
              <FieldError name="planIds" />
            </div>
          )}
        </fieldset>
      </AdminCard>

      <AdminCard title="Who can use it">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Audience" name="audience">
            {(id) => (
              <NativeSelect id={id} name="audience" value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
                {Object.entries(audiences).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="requiresCode"
                checked={codeRequired}
                disabled={audience === "SELECTED_CUSTOMERS"}
                onChange={(e) => setRequiresCode(e.target.checked)}
                className="mt-0.5 size-4 accent-ink"
              />
              <span>
                <span className="font-medium">Customers must enter a code</span>
                <span className="block text-xs text-muted-foreground">Otherwise the discount is applied automatically.</span>
              </span>
            </label>
            {audience === "SELECTED_CUSTOMERS" && <input type="hidden" name="requiresCode" value="on" />}
          </div>
        </div>
        {audience === "NEW_CUSTOMERS" && (
          <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Customers confirm it&apos;s their first order. The website checks previous orders privately and flags returning customers for you —
            the discount is always shown to the customer as “subject to verification” and you confirm the final price.
          </p>
        )}
        {codeRequired && (
          <Field label="Code" name="code" required className="mt-5 max-w-xs" hint="Letters and numbers, stored in capitals.">
            {(id) => <Input id={id} name="code" defaultValue={promotion?.code ?? ""} maxLength={30} className="font-mono uppercase" />}
          </Field>
        )}
        {audience === "SELECTED_CUSTOMERS" && (
          <Field
            label="Selected customers' emails"
            name="selectedEmails"
            className="mt-5"
            hint="One per line. Must match customers who have ordered before. Send these customers the code yourself."
          >
            {(id) => <Textarea id={id} name="selectedEmails" defaultValue={promotion?.selectedEmails.join("\n") ?? ""} rows={4} />}
          </Field>
        )}
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Field label="Total uses (optional)" name="totalRedemptionLimit" hint="Stop after this many order requests.">
            {(id) => <Input id={id} name="totalRedemptionLimit" inputMode="numeric" defaultValue={promotion?.totalRedemptionLimit ?? ""} />}
          </Field>
          <Field label="Uses per customer" name="perCustomerLimit" hint="Empty = no limit. Usually 1.">
            {(id) => <Input id={id} name="perCustomerLimit" inputMode="numeric" defaultValue={promotion ? (promotion.perCustomerLimit ?? "") : 1} />}
          </Field>
          <Field label="Priority" name="priority" hint="If two offers apply, the bigger discount wins; priority breaks ties.">
            {(id) => <Input id={id} name="priority" inputMode="numeric" defaultValue={promotion?.priority ?? 0} />}
          </Field>
        </div>
      </AdminCard>

      <AdminCard title="Schedule & countdown" description={`Times are in ${timeZone.replace("_", " ")} time. The countdown counts down to the real end time and never resets.`}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Starts" name="startsAt" required>
            {(id) => <Input id={id} type="datetime-local" name="startsAt" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="max-w-60" />}
          </Field>
          <Field label="Ends" name="endsAt" required>
            {(id) => <Input id={id} type="datetime-local" name="endsAt" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="max-w-60" />}
          </Field>
        </div>
        {duration && <p className={`mt-3 text-sm ${duration.warn ? "text-destructive" : "text-muted-foreground"}`}>{duration.text}</p>}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const start = nowLocal();
              const startUtc = zonedLocalToUtc(start, timeZone)!;
              setStartsAt(start);
              setEndsAt(utcToZonedInputValue(new Date(startUtc.getTime() + 72 * 3_600_000), timeZone));
            }}
          >
            Start now, run for 72 hours
          </Button>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="quick-end" className="block text-xs text-muted-foreground">
                End at 23:59 on
              </label>
              <Input id="quick-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-44" />
            </div>
            <Button type="button" variant="outline" disabled={!endDate} onClick={() => setEndsAt(`${endDate}T23:59`)}>
              Set end
            </Button>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <CheckboxField name="showCountdown" label="Show the countdown timer" defaultChecked={promotion?.showCountdown ?? true} />
          <CheckboxField
            name="showOnHomepage"
            label="Show the banner on the homepage"
            hint="Not available for selected-customer offers."
            defaultChecked={promotion?.showOnHomepage ?? true}
          />
        </div>
      </AdminCard>

      <AdminCard title="Terms & after the offer ends">
        <div className="grid gap-5">
          <Field label="Offer terms" name="terms" hint="Shown under the banner. Be clear and honest.">
            {(id) => <Textarea id={id} name="terms" defaultValue={promotion?.terms ?? ""} rows={3} maxLength={3000} />}
          </Field>
          <Field label="When the offer ends" name="expiredBehavior" hint="Discounts always stop at the end time, whatever you choose here.">
            {(id) => (
              <NativeSelect id={id} name="expiredBehavior" value={expiredBehavior} onChange={(e) => setExpiredBehavior(e.target.value as typeof expiredBehavior)}>
                <option value="HIDE">Remove the banner</option>
                <option value="SHOW_ENDED_MESSAGE">Show an “offer ended” message for 7 days</option>
              </NativeSelect>
            )}
          </Field>
          {expiredBehavior === "SHOW_ENDED_MESSAGE" && (
            <Field label="Ended message" name="expiredMessage">
              {(id) => (
                <Textarea
                  id={id}
                  name="expiredMessage"
                  defaultValue={promotion?.expiredMessage ?? "This offer has ended. Follow us on Instagram to hear about the next one."}
                  rows={2}
                  maxLength={400}
                />
              )}
            </Field>
          )}
        </div>
      </AdminCard>

      <AdminCard title="Go live">
        <CheckboxField
          name="isEnabled"
          label="Enable this campaign"
          hint="When enabled, it goes live automatically at the start time and stops at the end time."
          defaultChecked={promotion?.isEnabled ?? false}
        />
      </AdminCard>

      <FormActions>
        <SubmitButton>{promotion ? "Save campaign" : "Create campaign"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
