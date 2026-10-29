"use client";

import { AdminForm, Field, NativeSelect, SubmitButton } from "@/components/admin/form";
import { MoneyInput } from "@/components/admin/inputs";
import { Textarea } from "@/components/ui/textarea";
import { ORDER_STATUSES, ORDER_STATUS_HINTS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders/labels";
import {
  addOrderNoteAction,
  decideEligibilityAction,
  updateOrderStatusAction,
  updatePricePaymentAction,
} from "../actions";

const PAYMENT_OPTIONS = ["NOT_COLLECTED", "PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED"] as const;

export function StatusForm({ orderId, current }: { orderId: string; current: string }) {
  return (
    <AdminForm action={updateOrderStatusAction.bind(null, orderId)} className="space-y-3">
      <Field label="Status" name="status">
        {(id) => (
          <NativeSelect id={id} name="status" defaultValue={current}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {ORDER_STATUSES.map((s) => (
          <li key={s}>
            <span className="font-medium text-foreground">{ORDER_STATUS_LABELS[s]}:</span> {ORDER_STATUS_HINTS[s]}
          </li>
        ))}
      </ul>
      <Field label="Note (optional)" name="note" hint="Saved in the order history, e.g. “Called, confirmed Sunday collection”.">
        {(id) => <Textarea id={id} name="note" rows={2} maxLength={1000} />}
      </Field>
      <SubmitButton size="default">Update status</SubmitButton>
    </AdminForm>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  return (
    <AdminForm action={addOrderNoteAction.bind(null, orderId)} className="space-y-3" resetOnSuccess successMessage="Note added">
      <Field label="Add an internal note" name="body" hint="Only visible to your team.">
        {(id) => <Textarea id={id} name="body" rows={3} maxLength={4000} />}
      </Field>
      <SubmitButton size="default" pendingLabel="Adding…">
        Add note
      </SubmitButton>
    </AdminForm>
  );
}

export function PricePaymentForm({
  orderId,
  confirmedTotalCents,
  paymentStatus,
  paidAmountCents,
}: {
  orderId: string;
  confirmedTotalCents: number | null;
  paymentStatus: string;
  paidAmountCents: number | null;
}) {
  return (
    <AdminForm action={updatePricePaymentAction.bind(null, orderId)} className="space-y-4">
      <Field
        label="Agreed final price"
        name="confirmedTotal"
        hint="The amount you agreed with the customer. Leave empty until agreed. The original quote is kept unchanged."
      >
        {(id) => <MoneyInput id={id} name="confirmedTotal" defaultCents={confirmedTotalCents} placeholder="Not agreed yet" />}
      </Field>
      <div className="grid gap-4">
        <Field label="Payment" name="paymentStatus" hint="Recorded manually — no online payments yet.">
          {(id) => (
            <NativeSelect id={id} name="paymentStatus" defaultValue={paymentStatus}>
              {PAYMENT_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PAYMENT_STATUS_LABELS[p]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Amount received (optional)" name="paidAmount">
          {(id) => <MoneyInput id={id} name="paidAmount" defaultCents={paidAmountCents} />}
        </Field>
      </div>
      <SubmitButton size="default">Save price & payment</SubmitButton>
    </AdminForm>
  );
}

export function EligibilityDecisionForm({ orderId, hasDecision }: { orderId: string; hasDecision: boolean }) {
  return (
    <AdminForm action={decideEligibilityAction.bind(null, orderId)} className="space-y-3">
      <Field
        label={hasDecision ? "Change decision (optional note)" : "Decision note (optional)"}
        name="note"
        hint="e.g. “Checked Instagram DMs — first order” or “Ordered in March under another email”."
      >
        {(id) => <Textarea id={id} name="note" rows={2} maxLength={1000} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="default" name="decision" value="APPROVED" pendingLabel="Saving…">
          Approve promotion
        </SubmitButton>
        <SubmitButton size="default" variant="outline" name="decision" value="REJECTED" pendingLabel="Saving…">
          Reject promotion
        </SubmitButton>
      </div>
    </AdminForm>
  );
}
