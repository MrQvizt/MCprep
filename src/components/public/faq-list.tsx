import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TextBlock } from "./section";

export interface FaqItem {
  id?: string;
  question: string;
  answer: string;
}

/**
 * Accessible FAQ accordion built on <details>/<summary>: zero JavaScript and
 * the answers stay in the HTML for search engines.
 */
export function FaqList({ items, className, headingLevel: H = "h3" }: { items: FaqItem[]; className?: string; headingLevel?: "h2" | "h3" }) {
  if (items.length === 0) return null;
  return (
    <div className={cn("border-t border-current/15", className)}>
      {items.map((f, i) => (
        <details key={f.id ?? i} className="group border-b border-current/15 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left sm:py-6">
            <H className="font-display text-lg font-bold leading-snug sm:text-xl">{f.question}</H>
            <span
              aria-hidden="true"
              className="mt-0.5 inline-grid size-8 shrink-0 place-items-center border border-current/25 transition-transform duration-300 group-open:rotate-45"
            >
              <Plus className="size-4" />
            </span>
          </summary>
          <TextBlock text={f.answer} className="max-w-3xl pb-6 pr-12 text-[0.95rem] text-current/75" />
        </details>
      ))}
    </div>
  );
}
