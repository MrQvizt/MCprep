import { sanitizeRichText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

/** Renders admin-authored rich text. Always sanitised again at render time. */
export function RichText({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html?.trim()) return null;
  return <div className={cn("prose-brand max-w-none", className)} dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />;
}
