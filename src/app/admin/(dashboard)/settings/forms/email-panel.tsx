"use client";

import { useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendTestEmailAction } from "../actions";

export function SendTestEmailButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="lg"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const result = await sendTestEmailAction();
          if (result.ok) toast.success(result.message ?? "Test email sent");
          else toast.error(result.message ?? "Couldn't send the test email");
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      Send test email
    </Button>
  );
}
