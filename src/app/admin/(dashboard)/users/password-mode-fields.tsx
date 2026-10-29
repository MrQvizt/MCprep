"use client";

import { useState } from "react";
import { Field } from "@/components/admin/form";
import { Input } from "@/components/ui/input";

/** Choose between a generated temporary password and one typed by the owner. */
export function PasswordModeFields({ modeName = "passwordMode", label = "Password" }: { modeName?: string; label?: string }) {
  const [mode, setMode] = useState<"generate" | "set">("generate");
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{label}</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={modeName} value="generate" checked={mode === "generate"} onChange={() => setMode("generate")} className="accent-ink" />
        Generate a strong temporary password (recommended)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={modeName} value="set" checked={mode === "set"} onChange={() => setMode("set")} className="accent-ink" />
        I&apos;ll type a password
      </label>
      {mode === "set" && (
        <Field label="New password" name="password" hint="At least 12 characters, mixing letters with numbers or symbols.">
          {(id) => <Input id={id} name="password" type="password" autoComplete="new-password" className="max-w-sm" />}
        </Field>
      )}
    </fieldset>
  );
}
