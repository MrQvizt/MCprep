"use client";

import { AdminForm, Field, SubmitButton } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { saveCategory } from "../actions";

export function CategoryForm({ category }: { category?: { id: string; name: string; slug: string; description: string | null } }) {
  return (
    <AdminForm action={saveCategory.bind(null, category?.id ?? null)} resetOnSuccess={!category} className="grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
      <Field label="Name" name="name" required>
        {(id) => <Input id={id} name="name" defaultValue={category?.name} maxLength={60} />}
      </Field>
      <Field label="Address" name="slug" hint={category ? undefined : "Leave empty to create from the name"}>
        {(id) => <Input id={id} name="slug" defaultValue={category?.slug} maxLength={60} className="font-mono text-sm" />}
      </Field>
      <Field label="Description" name="description">
        {(id) => <Input id={id} name="description" defaultValue={category?.description ?? ""} maxLength={300} />}
      </Field>
      <SubmitButton size="default">{category ? "Save" : "Add category"}</SubmitButton>
    </AdminForm>
  );
}
