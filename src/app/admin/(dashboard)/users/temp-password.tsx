"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shows a generated password once, with a copy button. It is never stored in plain text. */
export function TempPasswordNotice({ password, email }: { password: string; email?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <p className="flex items-center gap-2 font-semibold">
        <KeyRound className="size-4" /> Temporary password{email ? ` for ${email}` : ""}
      </p>
      <p className="mt-1 text-emerald-900">
        Copy it now and share it privately (not by email if you can avoid it). It won&apos;t be shown again. They can change it under
        My account after signing in.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded bg-white px-3 py-2 font-mono text-base tracking-wider">{password}</code>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
