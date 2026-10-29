import { cn } from "@/lib/utils";

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "dark";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-foreground/80 ring-border",
  good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-amber-50 text-amber-900 ring-amber-200",
  bad: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-sky-50 text-sky-900 ring-sky-200",
  dark: "bg-ink text-white ring-ink",
};

export function StatusBadge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DemoBadge() {
  return (
    <StatusBadge tone="warn" className="uppercase tracking-wide">
      Sample — review
    </StatusBadge>
  );
}
