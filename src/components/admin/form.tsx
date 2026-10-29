"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useEffectEvent, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * useActionState + toast feedback. Returns [state, formAction, pending].
 * Shows a success toast (unless silent) and an error toast on failure.
 */
export function useAdminAction(action: FormAction, opts: { successMessage?: string; onSuccess?: (s: ActionState) => void } = {}) {
  const [state, formAction, pending] = useActionState(action, { ok: false } as ActionState);
  const lastTs = useRef<number | undefined>(undefined);
  const notify = useEffectEvent((s: ActionState) => {
    if (s.ok) {
      toast.success(s.message ?? opts.successMessage ?? "Saved");
      opts.onSuccess?.(s);
    } else if (s.message) {
      toast.error(s.message);
    }
  });
  useEffect(() => {
    if (!state.ts || state.ts === lastTs.current) return;
    lastTs.current = state.ts;
    notify(state);
  }, [state]);
  return [state, formAction, pending] as const;
}

const FormStateContext = createContext<ActionState>({ ok: false });

/** Form wired to a server action with toast feedback; children get field errors via FieldError. */
export function AdminForm({
  action,
  children,
  className,
  successMessage,
  onSuccess,
  resetOnSuccess = false,
}: {
  action: FormAction;
  children: React.ReactNode | ((state: ActionState) => React.ReactNode);
  className?: string;
  successMessage?: string;
  onSuccess?: (s: ActionState) => void;
  resetOnSuccess?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useAdminAction(action, {
    successMessage,
    onSuccess: (s) => {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(s);
    },
  });
  return (
    <form
      ref={ref}
      action={formAction}
      // Submit manually so React doesn't reset the fields after the action (keeps input on validation errors).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(data));
      }}
      className={className}
      noValidate
    >
      <FormStateContext value={state}>{typeof children === "function" ? children(state) : children}</FormStateContext>
    </form>
  );
}


export function useFormState() {
  return useContext(FormStateContext);
}

export function Field({
  label,
  name,
  hint,
  children,
  className,
  required,
  error: errorProp,
}: {
  label: React.ReactNode;
  name?: string;
  hint?: React.ReactNode;
  children: React.ReactNode | ((id: string) => React.ReactNode);
  className?: string;
  required?: boolean;
  error?: string;
}) {
  const id = useId();
  const state = useFormState();
  const error = errorProp ?? (name ? state.fieldErrors?.[name] : undefined);
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <div data-invalid={error ? "" : undefined} className="[&_[data-slot=input]]:aria-invalid:border-destructive">
        {typeof children === "function" ? children(id) : children}
      </div>
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FieldError({ name }: { name: string }) {
  const state = useFormState();
  const error = state.fieldErrors?.[name];
  if (!error) return null;
  return (
    <p className="text-xs font-medium text-destructive" role="alert">
      {error}
    </p>
  );
}

export function FormMessage() {
  const state = useFormState();
  if (!state.message || state.ok) return null;
  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {state.message}
    </div>
  );
}

export function SubmitButton({
  children = "Save",
  pendingLabel = "Saving…",
  className,
  variant,
  size = "lg",
  name,
  value,
  disabled,
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={cn("min-w-24", className)} disabled={pending || disabled} name={name} value={value}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t bg-background/95 px-1 py-4 backdrop-blur", className)}>
      {children}
    </div>
  );
}

/** Checkbox row with label + hint (native checkbox so it posts "on"). */
export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 size-4 shrink-0 rounded border-input accent-ink"
      />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </label>
    </div>
  );
}

/** Native select styled like shadcn inputs (works without client state). */
export function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50",
        className,
      )}
    />
  );
}
