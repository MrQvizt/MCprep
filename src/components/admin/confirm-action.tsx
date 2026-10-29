"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";

/** Button that asks for confirmation, then runs a (bound) server action. */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel = "Confirm",
  children,
  variant = "outline",
  size = "default",
  destructive = false,
  className,
}: {
  action: () => Promise<ActionState | void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  destructive?: boolean;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={variant} size={size} disabled={pending} className={className}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={() =>
              start(async () => {
                const result = await action();
                if (result && "ok" in result) {
                  if (result.ok) toast.success(result.message ?? "Done");
                  else toast.error(result.message ?? "Something went wrong");
                }
              })
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Small button that runs a bound server action without confirmation (e.g. move up/down, toggle). */
export function ActionButton({
  action,
  children,
  variant = "ghost",
  size = "icon-sm",
  label,
  className,
  disabled,
}: {
  action: () => Promise<ActionState | void>;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      disabled={pending || disabled}
      className={className}
      onClick={() =>
        start(async () => {
          const result = await action();
          if (result && "ok" in result && !result.ok && result.message) toast.error(result.message);
          else if (result && "ok" in result && result.ok && result.message) toast.success(result.message);
        })
      }
    >
      {children}
    </Button>
  );
}
