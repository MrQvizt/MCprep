import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Price with optional struck-through original. */
export function Price({
  cents,
  originalCents,
  currency = "EUR",
  size = "lg",
  className,
  onRequestLabel = "Price on request",
}: {
  cents: number | null;
  originalCents?: number | null;
  currency?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  onRequestLabel?: string;
}) {
  if (cents === null) {
    return <span className={cn("font-display font-extrabold uppercase", size === "xl" ? "text-2xl" : "text-lg", className)}>{onRequestLabel}</span>;
  }
  const discounted = originalCents !== null && originalCents !== undefined && originalCents > cents;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <span
        className={cn(
          "font-display font-black tabular leading-none tracking-tight",
          size === "xl" && "text-5xl sm:text-6xl",
          size === "lg" && "text-4xl sm:text-5xl",
          size === "md" && "text-2xl",
          size === "sm" && "text-lg",
        )}
      >
        {formatMoney(cents, currency, { hideZeroDecimals: true })}
      </span>
      {discounted && (
        <span className={cn("tabular text-current/50 line-through", size === "sm" ? "text-sm" : "text-base")}>
          <span className="sr-only">Was </span>
          {formatMoney(originalCents!, currency, { hideZeroDecimals: true })}
        </span>
      )}
    </span>
  );
}
