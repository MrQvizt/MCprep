"use client";

import { useEffect } from "react";
import { ErrorContent } from "@/components/public/error-content";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="dark min-h-dvh bg-ink">
      <ErrorContent reset={reset} digest={error.digest} />
    </div>
  );
}
