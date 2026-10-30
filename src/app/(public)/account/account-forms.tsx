"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import {
  changePasswordAction,
  claimOrderAction,
  deleteAccountAction,
  requestPasswordResetAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  updateProfileAction,
} from "./actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** useActionState without React's automatic form reset, so typed values survive an error. */
function useAccountForm(action: Action) {
  const [state, run, pending] = useActionState(action, { ok: false });
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => run(fd));
  };
  return { state, pending, onSubmit, formAction: run };
}

const inputCls =
  "h-12 w-full border border-ink/20 bg-white px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-ink aria-[invalid=true]:border-red-600";

function Field({
  label,
  name,
  error,
  hint,
  className,
  inputClassName,
  ...input
}: { label: string; name: string; error?: string; hint?: React.ReactNode; className?: string; inputClassName?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${name}`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-[0.14em] text-ink/70">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className={cn(inputCls, inputClassName)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-smoke">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function PasswordField(props: Omit<React.ComponentProps<typeof Field>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Field {...props} type={show ? "text" : "password"} inputClassName="pr-12" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-[1.625rem] grid size-10 place-items-center text-ink/50 hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function FormMessage({ state }: { state: ActionState }) {
  // A message already shown under its field isn't repeated here.
  if (!state.message || Object.values(state.fieldErrors ?? {}).includes(state.message)) return null;
  return state.ok ? (
    <p role="status" className="flex gap-2 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {state.message}
    </p>
  ) : (
    <p role="alert" className="bg-red-50 px-3.5 py-3 text-sm text-red-800">
      {state.message}
    </p>
  );
}

function Submit({ pending, children, variant = "dark", className }: { pending: boolean; children: React.ReactNode; variant?: "dark" | "danger"; className?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex h-12 w-full items-center justify-center gap-2 px-6 text-xs font-semibold uppercase tracking-[0.16em] transition-colors disabled:opacity-60",
        variant === "dark" ? "bg-ink text-white hover:bg-charcoal" : "bg-red-700 text-white hover:bg-red-800",
        className,
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" />} {children}
    </button>
  );
}

function ClaimFields({ claimRef, claimToken }: { claimRef?: string; claimToken?: string }) {
  if (!claimRef || !claimToken) return null;
  return (
    <>
      <input type="hidden" name="claimRef" value={claimRef} />
      <input type="hidden" name="claimToken" value={claimToken} />
    </>
  );
}

// ── Public forms ────────────────────────────────────────────────────────────

export function SignInForm({ next, claimRef, claimToken, email }: { next?: string; claimRef?: string; claimToken?: string; email?: string }) {
  const { state, pending, onSubmit, formAction } = useAccountForm(signInAction);
  const f = state.fieldErrors ?? {};
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <ClaimFields claimRef={claimRef} claimToken={claimToken} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={email} required error={f.email} />
      <PasswordField label="Password" name="password" autoComplete="current-password" required error={f.password} />
      <div className="-mt-2 text-right">
        <Link href="/account/forgot-password" className="text-sm text-ink/70 underline underline-offset-4 hover:text-ink">
          Forgot your password?
        </Link>
      </div>
      <FormMessage state={state} />
      <Submit pending={pending}>Sign in</Submit>
    </form>
  );
}

export function SignUpForm({
  next,
  claimRef,
  claimToken,
  defaults,
  minPassword,
}: {
  next?: string;
  claimRef?: string;
  claimToken?: string;
  defaults?: { name?: string; email?: string; phone?: string };
  minPassword: number;
}) {
  const { state, pending, onSubmit, formAction } = useAccountForm(signUpAction);
  const f = state.fieldErrors ?? {};
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <ClaimFields claimRef={claimRef} claimToken={claimToken} />
      <Field label="Your name" name="name" autoComplete="name" defaultValue={defaults?.name} required error={f.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={defaults?.email} required error={f.email} />
      <Field
        label="Phone (optional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={defaults?.phone}
        error={f.phone}
        hint="So we can fill it in on your next order."
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        minLength={minPassword}
        error={f.password}
        hint={`At least ${minPassword} characters, with a number or symbol.`}
      />
      <FormMessage state={state} />
      <Submit pending={pending}>Create account</Submit>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { state, pending, onSubmit, formAction } = useAccountForm(requestPasswordResetAction);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />
      <FormMessage state={state} />
      <Submit pending={pending}>Send reset link</Submit>
    </form>
  );
}

export function ResetPasswordForm({ token, minPassword }: { token: string; minPassword: number }) {
  const { state, pending, onSubmit, formAction } = useAccountForm(resetPasswordAction);
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        required
        minLength={minPassword}
        error={state.fieldErrors?.password}
        hint={`At least ${minPassword} characters, with a number or symbol.`}
      />
      <FormMessage state={state} />
      <Submit pending={pending}>Save new password</Submit>
    </form>
  );
}

// ── Signed-in forms ─────────────────────────────────────────────────────────

export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const { state, pending, onSubmit, formAction } = useAccountForm(updateProfileAction);
  const f = state.fieldErrors ?? {};
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Your name" name="name" autoComplete="name" defaultValue={name} required error={f.name} />
      <Field label="Email" name="email-display" type="email" value={email} readOnly disabled hint="Message us if you need to change your email." />
      <Field label="Phone" name="phone" type="tel" autoComplete="tel" defaultValue={phone} error={f.phone} />
      <FormMessage state={state} />
      <Submit pending={pending} className="sm:w-auto">
        Save details
      </Submit>
    </form>
  );
}

export function ChangePasswordForm({ minPassword }: { minPassword: number }) {
  const { state, pending, onSubmit, formAction } = useAccountForm(changePasswordAction);
  const f = state.fieldErrors ?? {};
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} onSubmit={onSubmit} className="space-y-5" noValidate>
      <PasswordField label="Current password" name="currentPassword" autoComplete="current-password" required error={f.currentPassword} />
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        required
        minLength={minPassword}
        error={f.newPassword}
        hint={`At least ${minPassword} characters. Other devices will be signed out.`}
      />
      <FormMessage state={state} />
      <Submit pending={pending} className="sm:w-auto">
        Change password
      </Submit>
    </form>
  );
}

export function DeleteAccountForm() {
  const { state, pending, onSubmit, formAction } = useAccountForm(deleteAccountAction);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-red-700 underline underline-offset-4">
        Delete my account
      </button>
    );
  }
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-5 border border-red-200 bg-red-50/60 p-4" noValidate>
      <p className="text-sm leading-relaxed text-ink/80">
        Your login and saved details are removed for good. Orders you placed stay with us for our records, but are no longer linked to an account.
      </p>
      <PasswordField label="Confirm with your password" name="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <FormMessage state={state} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Submit pending={pending} variant="danger" className="sm:w-auto">
          Delete account
        </Submit>
        <button type="button" onClick={() => setOpen(false)} className="h-12 px-6 text-xs font-semibold uppercase tracking-[0.16em] text-ink/70 hover:text-ink">
          Keep my account
        </button>
      </div>
    </form>
  );
}

/** "Save this order to my account" for a signed-in customer on the confirmation page. */
export function ClaimOrderForm({ reference, token }: { reference: string; token: string }) {
  const { state, pending, onSubmit, formAction } = useAccountForm(claimOrderAction);
  if (state.ok) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-ink">
        <CheckCircle2 className="size-4" aria-hidden="true" /> Saved to{" "}
        <Link href="/account" className="font-semibold underline underline-offset-4">
          your account
        </Link>
      </p>
    );
  }
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="ref" value={reference} />
      <input type="hidden" name="t" value={token} />
      {state.message && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
      <Submit pending={pending}>Save to my account</Submit>
    </form>
  );
}
