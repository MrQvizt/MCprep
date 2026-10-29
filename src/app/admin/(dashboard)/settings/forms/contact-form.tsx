"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdminForm, CheckboxField, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SettingsOf } from "@/lib/settings/schema";
import { fillTemplate, whatsappLink } from "@/lib/whatsapp";
import { saveSettingsSection } from "../actions";

export function ContactForm({ values }: { values: SettingsOf<"contact"> }) {
  const [number, setNumber] = useState(values.whatsappNumber);
  const [message, setMessage] = useState(values.whatsappDefaultMessage);
  const preview = whatsappLink(number, message);

  return (
    <AdminForm action={saveSettingsSection.bind(null, "contact")} className="space-y-8">
      <section className="space-y-5">
        <h3 className="text-base font-semibold">Email &amp; phone</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Public email" name="publicEmail" hint="Shown on the website for customer questions.">
            {(id) => <Input id={id} name="publicEmail" type="email" defaultValue={values.publicEmail} maxLength={200} />}
          </Field>
          <Field label="Phone (optional)" name="phone" hint="Maltese numbers can be typed without +356.">
            {(id) => <Input id={id} name="phone" type="tel" defaultValue={values.phone} maxLength={30} />}
          </Field>
          <Field
            label="Order notification emails"
            name="orderNotificationEmails"
            className="sm:col-span-2"
            hint="New order requests are emailed here. One address per line (up to 5). If empty, the public email is used."
          >
            {(id) => (
              <Textarea id={id} name="orderNotificationEmails" defaultValue={values.orderNotificationEmails.join("\n")} rows={3} />
            )}
          </Field>
          <Field label="Reply-to email (optional)" name="replyToEmail" hint="Where customer replies to confirmation emails go.">
            {(id) => <Input id={id} name="replyToEmail" type="email" defaultValue={values.replyToEmail} maxLength={200} />}
          </Field>
          <Field label="Support hours (optional)" name="supportHours" hint="e.g. Replies within a few hours, 9:00–19:00.">
            {(id) => <Input id={id} name="supportHours" defaultValue={values.supportHours} maxLength={200} />}
          </Field>
        </div>
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold">WhatsApp</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="WhatsApp number" name="whatsappNumber" hint="The number customers message, e.g. 7912 3456.">
            {(id) => (
              <Input id={id} name="whatsappNumber" type="tel" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={30} />
            )}
          </Field>
          <div className="flex items-end">
            <CheckboxField
              name="whatsappEnabled"
              label="Show the floating WhatsApp button"
              hint="Bottom-right on every public page. It appears once a valid WhatsApp number is saved."
              defaultChecked={values.whatsappEnabled}
            />
          </div>
        </div>
        <Field label="Default message" name="whatsappDefaultMessage" hint="Pre-filled when a visitor taps the WhatsApp button.">
          {(id) => (
            <Textarea id={id} name="whatsappDefaultMessage" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={500} />
          )}
        </Field>
        <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
          {preview ? (
            <a href={preview} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4">
              Test this WhatsApp link <ExternalLink className="size-3.5" />
            </a>
          ) : (
            <span className="text-muted-foreground">Enter a valid WhatsApp number to preview the link.</span>
          )}
        </div>
        <Field
          label="Message after an order request"
          name="whatsappOrderMessage"
          hint="Pre-filled on the order confirmation page. {reference} becomes the order reference."
        >
          {(id) => <Textarea id={id} name="whatsappOrderMessage" defaultValue={values.whatsappOrderMessage} rows={2} maxLength={500} />}
        </Field>
        <Field
          label="Your follow-up message to customers"
          name="whatsappFollowUpMessage"
          hint="Used by the WhatsApp button on each order. Placeholders: {firstName}, {reference}, {plan}."
        >
          {(id) => <Textarea id={id} name="whatsappFollowUpMessage" defaultValue={values.whatsappFollowUpMessage} rows={3} maxLength={600} />}
        </Field>
        <p className="text-xs text-muted-foreground">
          Example:{" "}
          <em>{fillTemplate(values.whatsappFollowUpMessage, { firstName: "Maria", reference: "MCP-000123", plan: "2 Weeks" })}</em>
        </p>
      </section>

      <section className="space-y-5">
        <h3 className="text-base font-semibold">Instagram &amp; social</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Instagram profile link" name="instagramUrl">
            {(id) => <Input id={id} name="instagramUrl" type="url" defaultValue={values.instagramUrl} maxLength={300} />}
          </Field>
          <Field label="Instagram handle" name="instagramHandle" hint="Without the @, e.g. mcpreps.mt">
            {(id) => <Input id={id} name="instagramHandle" defaultValue={values.instagramHandle} maxLength={31} />}
          </Field>
        </div>
        <CheckboxField
          name="instagramDmEnabled"
          label="Show “Message us on Instagram” buttons"
          hint="Lets customers keep ordering by Instagram DM if they prefer."
          defaultChecked={values.instagramDmEnabled}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Facebook page (optional)" name="facebookUrl">
            {(id) => <Input id={id} name="facebookUrl" type="url" defaultValue={values.facebookUrl} maxLength={300} />}
          </Field>
          <Field label="TikTok (optional)" name="tiktokUrl">
            {(id) => <Input id={id} name="tiktokUrl" type="url" defaultValue={values.tiktokUrl} maxLength={300} />}
          </Field>
        </div>
        <div className="rounded-md border px-4 py-3 text-sm">
          <p className="font-medium">Google Business Profile &amp; review link</p>
          <p className="mt-1 text-muted-foreground">
            {values.googleBusinessProfileUrl ? values.googleBusinessProfileUrl : "Not set yet."}
            {values.googleReviewUrl ? ` · Review link: ${values.googleReviewUrl}` : ""}
          </p>
          <Link href="/admin/listings" className="mt-2 inline-block text-sm font-medium underline underline-offset-4">
            Manage in Google &amp; listings
          </Link>
        </div>
      </section>

      <FormActions>
        <SubmitButton>Save contact &amp; social</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
