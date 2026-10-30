"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { AdminForm, Field, NativeSelect, SubmitButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createAccountResetLinkAction,
  deleteWebsiteAccountAction,
  saveCustomerNotesAction,
  setCustomerStatusAction,
} from "../actions";

export function CustomerStatusForm({ customerId, current }: { customerId: string; current: "AUTO" | "FIRST_TIME" | "EXISTING" }) {
  return (
    <AdminForm action={setCustomerStatusAction.bind(null, customerId)} className="space-y-3">
      <Field
        label="Treat this person as"
        name="manualStatus"
        hint="Affects first-order promotion checks. “Automatic” decides from confirmed orders. Every change is recorded."
      >
        {(id) => (
          <NativeSelect id={id} name="manualStatus" defaultValue={current}>
            <option value="AUTO">Automatic (based on order history)</option>
            <option value="FIRST_TIME">First-time customer</option>
            <option value="EXISTING">Existing customer</option>
          </NativeSelect>
        )}
      </Field>
      <SubmitButton size="default">Save</SubmitButton>
    </AdminForm>
  );
}

export function CustomerNotesForm({ customerId, notes }: { customerId: string; notes: string | null }) {
  return (
    <AdminForm action={saveCustomerNotesAction.bind(null, customerId)} className="space-y-3">
      <Field label="Team notes" name="notes" hint="Private notes for your team, e.g. preferences or how they like to be contacted.">
        {(id) => <Textarea id={id} name="notes" defaultValue={notes ?? ""} rows={4} maxLength={4000} />}
      </Field>
      <SubmitButton size="default">Save notes</SubmitButton>
    </AdminForm>
  );
}

/** Website login tools: one-time password link to send the customer, or delete the login. */
export function WebsiteAccountTools({ customerId, accountId, email }: { customerId: string; accountId: string; email: string }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await createAccountResetLinkAction(customerId, accountId);
              if (result.ok && result.data) {
                setLink(result.data.url);
                setCopied(false);
              } else toast.error(result.message ?? "Couldn't create the link");
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Create password link
        </Button>
        <p className="mt-1.5 text-xs text-muted-foreground">
          For a customer who can&apos;t get in. Send it to {email} (e.g. on WhatsApp). It works once, for 48 hours.
        </p>
      </div>
      {link && (
        <div className="flex gap-2">
          <Input readOnly value={link} aria-label="Password reset link" className="h-9 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button
            type="button"
            variant="secondary"
            className="h-9"
            onClick={async () => {
              await navigator.clipboard?.writeText(link).catch(() => {});
              setCopied(true);
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
      <div className="border-t pt-4">
        <ConfirmAction
          action={deleteWebsiteAccountAction.bind(null, customerId, accountId)}
          title="Delete this website account?"
          description="They won't be able to sign in any more. Their orders and customer record stay as they are."
          confirmLabel="Delete account"
          destructive
          variant="ghost"
        >
          <Trash2 className="size-4" /> Delete website account
        </ConfirmAction>
      </div>
    </div>
  );
}
