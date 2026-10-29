"use client";

import { AdminForm, CheckboxField, Field, FormActions, NativeSelect, SubmitButton, useFormState } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { saveRedirect } from "./actions";

export interface RedirectValues {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  note: string | null;
  isActive: boolean;
}

function Confirmations() {
  const state = useFormState();
  const replace = state.fieldErrors?.confirmReplacePage;
  const unknown = state.fieldErrors?.confirmUnknownTarget;
  if (!replace && !unknown) return null;
  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      {replace && (
        <div>
          <p>{replace}</p>
          <div className="mt-2">
            <CheckboxField name="confirmReplacePage" label="Yes, redirect this live page" />
          </div>
        </div>
      )}
      {unknown && (
        <div>
          <p>{unknown}</p>
          <div className="mt-2">
            <CheckboxField name="confirmUnknownTarget" label="I'm sure the new address is correct" />
          </div>
        </div>
      )}
    </div>
  );
}

export function RedirectForm({ rule, compact = false }: { rule?: RedirectValues; compact?: boolean }) {
  return (
    <AdminForm action={saveRedirect.bind(null, rule?.id ?? null)} className="space-y-5" resetOnSuccess={!rule}>
      <div className={compact ? "grid gap-4 md:grid-cols-[1fr_1fr_180px]" : "grid gap-5 md:grid-cols-2"}>
        <Field label="Old address" name="fromPath" required hint="The address people or Google still use, e.g. /old-menu">
          {(id) => <Input id={id} name="fromPath" defaultValue={rule?.fromPath} placeholder="/old-page" autoComplete="off" />}
        </Field>
        <Field label="New address" name="toPath" required hint="A page on your site (e.g. /menu) or a full https:// link">
          {(id) => <Input id={id} name="toPath" defaultValue={rule?.toPath} placeholder="/menu" autoComplete="off" />}
        </Field>
        <Field label="Type" name="statusCode" hint={compact ? undefined : "Use permanent (301) unless the move is temporary."}>
          {(id) => (
            <NativeSelect id={id} name="statusCode" defaultValue={String(rule?.statusCode ?? 301)}>
              <option value="301">Permanent (301)</option>
              <option value="302">Temporary (302)</option>
            </NativeSelect>
          )}
        </Field>
        {!compact && (
          <Field label="Note (optional)" name="note" hint="Why this redirect exists — just for you.">
            {(id) => <Input id={id} name="note" defaultValue={rule?.note ?? ""} maxLength={300} />}
          </Field>
        )}
      </div>
      <CheckboxField name="isActive" label="Active" defaultChecked={rule?.isActive ?? true} />
      <Confirmations />
      <FormActions className={compact ? "static border-0 bg-transparent p-0" : undefined}>
        <SubmitButton>{rule ? "Save redirect" : "Add redirect"}</SubmitButton>
      </FormActions>
    </AdminForm>
  );
}
