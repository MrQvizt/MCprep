"use client";

import { useRouter } from "next/navigation";
import { AdminForm, Field, FormActions, SubmitButton } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { changePasswordAction, updateProfileAction } from "./actions";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  return (
    <AdminForm action={updateProfileAction} className="space-y-5">
      <Field label="Your name" name="name" required>
        {(id) => <Input id={id} name="name" defaultValue={name} maxLength={80} autoComplete="name" />}
      </Field>
      <Field label="Sign-in email" name="email" required>
        {(id) => <Input id={id} name="email" type="email" defaultValue={email} maxLength={200} autoComplete="email" />}
      </Field>
      <Field label="Current password" name="currentPassword" hint="Only needed if you change your email.">
        {(id) => <Input id={id} name="currentPassword" type="password" autoComplete="current-password" className="max-w-sm" />}
      </Field>
      <FormActions>
        <SubmitButton>Save profile</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}

export function PasswordForm() {
  const router = useRouter();
  return (
    <AdminForm
      action={changePasswordAction}
      className="space-y-5"
      resetOnSuccess
      onSuccess={() => {
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      <Field label="Current password" name="currentPassword" required>
        {(id) => <Input id={id} name="currentPassword" type="password" autoComplete="current-password" className="max-w-sm" />}
      </Field>
      <Field label="New password" name="newPassword" required hint="At least 12 characters, mixing letters with numbers or symbols.">
        {(id) => <Input id={id} name="newPassword" type="password" autoComplete="new-password" className="max-w-sm" />}
      </Field>
      <Field label="Repeat new password" name="confirmPassword" required>
        {(id) => <Input id={id} name="confirmPassword" type="password" autoComplete="new-password" className="max-w-sm" />}
      </Field>
      <p className="text-xs text-muted-foreground">Changing your password signs you out everywhere, including other devices.</p>
      <SubmitButton>Change password</SubmitButton>
    </AdminForm>
  );
}
