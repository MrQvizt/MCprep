"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";

/** Accessible tick box that saves immediately via a bound server action. */
export function ChecklistToggle({
  done,
  label,
  action,
}: {
  done: boolean;
  label: string;
  action: (done: boolean) => Promise<ActionState>;
}) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(done);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={label}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const res = await action(!optimistic);
          if (!res.ok) toast.error(res.message ?? "Couldn't save");
        })
      }
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors",
        optimistic ? "border-ink bg-ink text-white" : "border-input bg-background hover:border-ink",
      )}
    >
      {optimistic && <Check className="size-4" strokeWidth={3} />}
    </button>
  );
}
