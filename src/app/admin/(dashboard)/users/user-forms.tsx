"use client";

import Link from "next/link";
import { AdminForm, Field, FormActions, NativeSelect, SubmitButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUserAction, resetUserPasswordAction, updateUserAction } from "./actions";
import { PasswordModeFields } from "./password-mode-fields";
import { TempPasswordNotice } from "./temp-password";

const ROLE_OPTIONS = [
  { value: "EDITOR", label: "Content editor — meals, photos, blog, SEO (no customer data)" },
  { value: "ADMIN", label: "Administrator — everything except admin accounts" },
  { value: "OWNER", label: "Owner — everything, including admin accounts" },
];

export function NewUserForm() {
  return (
    <AdminForm action={createUserAction} className="max-w-2xl space-y-6" resetOnSuccess>
      {(state) => {
        const data = state.ok ? (state.data as { id: string; email: string; tempPassword?: string } | undefined) : undefined;
        return (
          <>
            {data && (
              <div className="space-y-3">
                {data.tempPassword ? (
                  <TempPasswordNotice password={data.tempPassword} email={data.email} />
                ) : (
                  <p className="rounded-lg border bg-muted/50 p-4 text-sm">Account created for {data.email} with the password you chose.</p>
                )}
                <Button asChild variant="outline">
                  <Link href={`/admin/users/${data.id}`}>View account</Link>
                </Button>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" name="name" required>
                {(id) => <Input id={id} name="name" maxLength={80} autoComplete="off" />}
              </Field>
              <Field label="Email" name="email" required hint="They sign in with this address.">
                {(id) => <Input id={id} name="email" type="email" maxLength={200} autoComplete="off" />}
              </Field>
            </div>
            <Field label="Role" name="role">
              {(id) => (
                <NativeSelect id={id} name="role" defaultValue="EDITOR">
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <PasswordModeFields />
            <FormActions>
              <SubmitButton>Create account</SubmitButton>
            </FormActions>
          </>
        );
      }}
    </AdminForm>
  );
}

export function EditUserForm({ user, isSelf }: { user: { id: string; name: string; role: string }; isSelf: boolean }) {
  return (
    <AdminForm action={updateUserAction.bind(null, user.id)} className="space-y-5">
      <Field label="Name" name="name" required>
        {(id) => <Input id={id} name="name" defaultValue={user.name} maxLength={80} />}
      </Field>
      <Field label="Role" name="role" hint={isSelf ? "You can't change your own role." : "Changing the role signs them out so it applies immediately."}>
        {(id) => (
          <>
            <NativeSelect id={id} name={isSelf ? undefined : "role"} defaultValue={user.role} disabled={isSelf}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
            {isSelf && <input type="hidden" name="role" value={user.role} />}
          </>
        )}
      </Field>
      <FormActions>
        <SubmitButton>Save</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  return (
    <AdminForm action={resetUserPasswordAction.bind(null, userId)} className="space-y-5">
      {(state) => {
        const temp = state.ok ? (state.data as { tempPassword?: string } | undefined)?.tempPassword : undefined;
        return (
          <>
            {temp && <TempPasswordNotice password={temp} />}
            <PasswordModeFields modeName="mode" label="New password" />
            <p className="text-xs text-muted-foreground">Resetting signs them out on all devices.</p>
            <SubmitButton variant="outline">Reset password</SubmitButton>
          </>
        );
      }}
    </AdminForm>
  );
}
