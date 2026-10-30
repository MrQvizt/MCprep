"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Banknote, CheckCircle2, ChevronDown, Loader2, Undo2 } from "lucide-react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ActionState } from "@/lib/actions";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/orders/labels";
import { quickMarkPaid, quickMarkUnpaid, quickOrderStatus } from "./actions";

function report(result: ActionState) {
  if (result.ok) toast.success(result.message ?? "Saved");
  else toast.error(result.message ?? "Something went wrong");
}

/** "Mark paid ▾" with the payment methods (cash, Revolut, bank transfer, card). */
export function MarkPaidMenu({ orderId, size = "default" }: { orderId: string; size?: "sm" | "default" }) {
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size={size} variant="outline" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />} Mark paid
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>How did they pay?</DropdownMenuLabel>
        {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
          <DropdownMenuItem key={m} onSelect={() => start(async () => report(await quickMarkPaid(orderId, m)))}>
            {PAYMENT_METHODS[m]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Undo a recorded payment (asks first). */
export function MarkUnpaidButton({ orderId, reference }: { orderId: string; reference: string }) {
  return (
    <ConfirmAction
      action={quickMarkUnpaid.bind(null, orderId)}
      title={`Mark ${reference} as not paid?`}
      description="The recorded payment (method, amount and date) is removed. Use this if it was marked paid by mistake."
      confirmLabel="Mark not paid"
      variant="ghost"
    >
      <Undo2 className="size-4" /> Undo payment
    </ConfirmAction>
  );
}

/** Compact "Confirm" for the order list. */
export function ConfirmOrderButton({ orderId, size = "sm" }: { orderId: string; size?: "sm" | "default" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      disabled={pending}
      onClick={() => start(async () => report(await quickOrderStatus(orderId, "CONFIRMED")))}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Confirm
    </Button>
  );
}
