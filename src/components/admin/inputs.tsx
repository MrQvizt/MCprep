import { Input } from "@/components/ui/input";
import { centsToInputValue } from "@/lib/money";
import { DEFAULT_TIME_ZONE, utcToZonedInputValue } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Euro amount input. Posts a decimal string ("12.50"); parse with parseMoneyToCents. */
export function MoneyInput({
  name,
  id,
  defaultCents,
  placeholder = "0.00",
  className,
  required,
}: {
  name: string;
  id?: string;
  defaultCents?: number | null;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">€</span>
      <Input
        id={id}
        name={name}
        inputMode="decimal"
        autoComplete="off"
        defaultValue={centsToInputValue(defaultCents)}
        placeholder={placeholder}
        required={required}
        className="pl-7 tabular"
      />
    </div>
  );
}

/** Date-time in the business time zone. Parse with zonedLocalToUtc on the server. */
export function DateTimeInput({
  name,
  id,
  defaultValue,
  timeZone = DEFAULT_TIME_ZONE,
  required,
}: {
  name: string;
  id?: string;
  defaultValue?: Date | null;
  timeZone?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type="datetime-local"
        name={name}
        defaultValue={utcToZonedInputValue(defaultValue ?? null, timeZone)}
        required={required}
        className="max-w-60"
      />
      <span className="text-xs text-muted-foreground">Malta time</span>
    </div>
  );
}
