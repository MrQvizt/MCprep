"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { useServerClockSeconds } from "@/hooks/use-server-clock";
import { formatShortDay, WEEKDAY_NAMES } from "@/lib/order-cutoff";
import { addDaysToDateString } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface OrderCutoffProps {
  /** Next deadline (ISO). */
  cutoff: string;
  /** Calendar day of the deadline (YYYY-MM-DD). */
  cutoffDay: string;
  /** Monday of the week these orders are for (YYYY-MM-DD). */
  weekStart: string;
  /** e.g. "4pm" */
  timeLabel: string;
  serverNow: string;
}

const WEEK_MS = 7 * 86_400_000;

/** Current deadline, rolling forward a week at a time once it passes (no reload needed). */
function useCutoff(p: OrderCutoffProps) {
  const now = useServerClockSeconds(p.serverNow) * 1000;
  let cutoff = new Date(p.cutoff).getTime();
  let weeks = 0;
  while (cutoff <= now && weeks < 8) {
    cutoff += WEEK_MS;
    weeks++;
  }
  const cutoffDay = addDaysToDateString(p.cutoffDay, weeks * 7);
  const weekStart = addDaysToDateString(p.weekStart, weeks * 7);
  const remaining = Math.max(0, Math.floor((cutoff - now) / 1000));
  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const left = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  const weekday = WEEKDAY_NAMES[new Date(`${cutoffDay}T00:00:00Z`).getUTCDay()];
  return {
    cutoffDay,
    weekStart,
    /** Monday after that (orders placed after the deadline start then). */
    followingWeek: addDaysToDateString(weekStart, 7),
    left,
    weekday,
    urgent: remaining < 6 * 3600,
  };
}

/** "Mon 9 Nov" → "9 Nov" */
const dayMonth = (ymd: string) => formatShortDay(ymd).split(" ").slice(1).join(" ");

/**
 * Slim site-wide strip: "Order by Wed 4 Nov, 4pm for delivery from Mon 9 Nov · 5d 5h left".
 * Always names the week: after Wednesday's deadline "next week" is already closed.
 */
export function OrderCutoffBar(p: OrderCutoffProps) {
  const pathname = usePathname();
  const c = useCutoff(p);
  if (pathname.startsWith("/order")) return null; // the order page shows the full notice
  return (
    <div className="border-b border-white/10 bg-charcoal text-white" role="note" aria-label="Ordering deadline">
      <Link
        href="/order"
        className="container-site flex min-h-9 items-center justify-center gap-2 py-1.5 text-center text-[0.7rem] font-medium tracking-wide sm:text-xs"
      >
        <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="sm:hidden">
            Week of {dayMonth(c.weekStart)}: order by {c.weekday.slice(0, 3)} {p.timeLabel}
          </span>
          <span className="hidden sm:inline">
            Order by <strong className="font-semibold">{formatShortDay(c.cutoffDay)}, {p.timeLabel}</strong> for delivery from{" "}
            <strong className="font-semibold">{formatShortDay(c.weekStart)}</strong>
          </span>
        </span>
        <span className={cn("rounded-sm px-1.5 py-0.5 tabular", c.urgent ? "bg-white text-ink" : "bg-white/10")}>{c.left} left</span>
      </Link>
    </div>
  );
}

/** Full notice for the order page. */
export function OrderCutoffCard(p: OrderCutoffProps & { className?: string }) {
  const c = useCutoff(p);
  return (
    <div role="note" className={cn("flex gap-3 border border-white/20 bg-white/[0.03] p-4 text-sm", p.className)}>
      <CalendarClock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">
          Order by {formatShortDay(c.cutoffDay)}, {p.timeLabel} for delivery from {formatShortDay(c.weekStart)}.
        </p>
        <p className="mt-1 text-fog">
          Orders close every {c.weekday} at {p.timeLabel} (Malta time) for the following week. Orders placed after{" "}
          <span className="text-white">{formatShortDay(c.cutoffDay)}, {p.timeLabel}</span> start from{" "}
          <span className="text-white">{formatShortDay(c.followingWeek)}</span>.{" "}
          <span className={cn("tabular", c.urgent ? "font-semibold text-white" : "")}>Closes in {c.left}.</span>
        </p>
      </div>
    </div>
  );
}
