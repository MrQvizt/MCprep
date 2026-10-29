"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionButton, ConfirmAction } from "@/components/admin/confirm-action";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatWeekdays } from "@/lib/time";
import { deleteDeliveryAreaAction, moveDeliveryArea, setDeliveryAreasEnabledAction, toggleDeliveryAreaPublished } from "./actions";

export interface AreaRow {
  id: string;
  name: string;
  slug: string;
  region: string;
  deliveryAvailable: boolean;
  isPublished: boolean;
  deliveryFeeCents: number | null;
  minOrderCents: number | null;
  deliveryDays: number[];
  hasPublicPage: boolean;
}

const REGION: Record<string, string> = { MALTA: "Malta", GOZO: "Gozo", COMINO: "Comino" };

export function AreasList({ areas }: { areas: AreaRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | boolean>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = selected.size === areas.length && areas.length > 0;
  const selectedNames = areas.filter((a) => selected.has(a.id)).map((a) => a.name);

  const run = (enabled: boolean) =>
    start(async () => {
      const result = await setDeliveryAreasEnabledAction([...selected], enabled);
      if (result.ok) {
        toast.success(result.message ?? "Updated");
        setSelected(new Set());
      } else toast.error(result.message ?? "Something went wrong");
      setConfirm(null);
    });

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-ink"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(areas.map((a) => a.id)))}
            aria-label="Select all localities"
          />
          Select all
        </label>
        <span className="text-sm text-muted-foreground">{selected.size} selected</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={selected.size === 0 || pending} onClick={() => setConfirm(true)}>
            Switch on delivery
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={selected.size === 0 || pending} onClick={() => setConfirm(false)}>
            Switch off
          </Button>
        </div>
      </div>
      <ul className="divide-y">
        {areas.map((a, i) => (
          <li key={a.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-ink"
                checked={selected.has(a.id)}
                onChange={() => toggle(a.id)}
                aria-label={`Select ${a.name}`}
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/delivery/areas/${a.id}`} className="font-medium hover:underline">
                    {a.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{REGION[a.region] ?? a.region}</span>
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {a.deliveryAvailable ? <StatusBadge tone="good">Delivers here</StatusBadge> : <StatusBadge tone="warn">Not confirmed</StatusBadge>}
                  <StatusBadge tone={a.isPublished ? "info" : "neutral"}>{a.isPublished ? "On website" : "Hidden"}</StatusBadge>
                  {a.hasPublicPage && <StatusBadge tone="dark">Own page</StatusBadge>}
                  {a.deliveryFeeCents !== null && <StatusBadge>Fee {formatMoney(a.deliveryFeeCents)}</StatusBadge>}
                  {a.minOrderCents !== null && <StatusBadge>Min {formatMoney(a.minOrderCents)}</StatusBadge>}
                  {a.deliveryDays.length > 0 && <StatusBadge>{formatWeekdays(a.deliveryDays)}</StatusBadge>}
                </span>
              </span>
            </label>
            <div className="flex items-center gap-1">
              <ActionButton action={moveDeliveryArea.bind(null, a.id, "up")} label="Move up" disabled={i === 0}>
                <ArrowUp className="size-4" />
              </ActionButton>
              <ActionButton action={moveDeliveryArea.bind(null, a.id, "down")} label="Move down" disabled={i === areas.length - 1}>
                <ArrowDown className="size-4" />
              </ActionButton>
              <ActionButton action={toggleDeliveryAreaPublished.bind(null, a.id)} label={a.isPublished ? "Hide from website" : "Show on website"}>
                {a.isPublished ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </ActionButton>
              <Button asChild variant="ghost" size="icon-sm" aria-label={`Edit ${a.name}`}>
                <Link href={`/admin/delivery/areas/${a.id}`}>
                  <Pencil className="size-4" />
                </Link>
              </Button>
              <ConfirmAction
                action={deleteDeliveryAreaAction.bind(null, a.id)}
                title={`Delete ${a.name}?`}
                description="It disappears from the website and the order form. Past orders keep the locality name."
                confirmLabel="Delete"
                destructive
                variant="ghost"
                size="icon-sm"
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Delete {a.name}</span>
              </ConfirmAction>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm ? "Switch on delivery?" : "Switch off delivery?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm
                ? `Confirm that you really deliver to: ${selectedNames.join(", ")}. They will appear on the website and customers can choose them in the order form.`
                : `${selectedNames.join(", ")} will be hidden and customers won't be able to choose them.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm !== null && run(confirm)} disabled={pending}>
              {confirm ? "Yes, we deliver there" : "Switch off"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
