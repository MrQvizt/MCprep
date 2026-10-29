"use client";

import { useEffect } from "react";
import { ErrorContent } from "@/components/public/error-content";

export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorContent reset={reset} digest={error.digest} />;
}
