"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/hooks/use-hydrated";
import { useServerClockSeconds } from "@/hooks/use-server-clock";
import { cn } from "@/lib/utils";

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * Countdown to a fixed, real end timestamp from the database. The server's
 * clock is used as the reference (corrects wrong device clocks), so the timer
 * is identical across refreshes, devices and time zones and never resets.
 * When it reaches zero the page refreshes so server-side pricing updates.
 */
export function Countdown({
  endsAt,
  serverNow,
  className,
  size = "lg",
  endedLabel = "This offer has ended",
  refreshOnEnd = true,
  label = "Offer ends in",
}: {
  endsAt: string;
  serverNow: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  endedLabel?: string;
  refreshOnEnd?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const end = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const hydrated = useHydrated();
  const now = useServerClockSeconds(serverNow) * 1000;
  // Formatted on the client only, to avoid server/browser locale differences during hydration.
  const endLabel = hydrated
    ? new Date(end).toLocaleString("en-GB", { timeZone: "Europe/Malta", dateStyle: "full", timeStyle: "short" })
    : null;

  const remaining = end - now;
  const ended = remaining <= 0;

  useEffect(() => {
    if (!ended || !refreshOnEnd) return;
    const id = window.setTimeout(() => router.refresh(), 1500);
    return () => window.clearTimeout(id);
  }, [ended, refreshOnEnd, router]);

  if (ended) {
    return (
      <p role="status" className={cn("eyebrow", className)}>
        {endedLabel}
      </p>
    );
  }

  const parts = split(remaining);
  const units = [
    ...(parts.days > 0 ? [{ key: "days", label: "Days", value: parts.days }] : []),
    { key: "hours", label: "Hours", value: parts.hours },
    { key: "minutes", label: "Min", value: parts.minutes },
    { key: "seconds", label: "Sec", value: parts.seconds },
  ];
  return (
    <div className={cn("inline-flex flex-col gap-2", className)}>
      {label && <p className="eyebrow text-current/70">{label}</p>}
      <div
        role="timer"
        aria-live="off"
        aria-label={`${label}: ${parts.days > 0 ? `${parts.days} days, ` : ""}${parts.hours} hours, ${parts.minutes} minutes.`}
        className="flex items-stretch gap-2 sm:gap-3"
      >
        {units.map((u, i) => (
          <div key={u.key} className="flex items-stretch gap-2 sm:gap-3">
            <div
              className={cn(
                "flex flex-col items-center justify-center border border-current/20 bg-current/[0.04]",
                size === "lg" && "min-w-[4.25rem] px-2 py-3 sm:min-w-[5.5rem] sm:py-4",
                size === "md" && "min-w-[3.5rem] px-2 py-2",
                size === "sm" && "min-w-[2.75rem] px-1.5 py-1.5",
              )}
            >
              <span
                key={u.value}
                className={cn(
                  "font-display font-black tabular leading-none animate-in fade-in slide-in-from-top-1 duration-300",
                  size === "lg" && "text-3xl sm:text-5xl",
                  size === "md" && "text-2xl",
                  size === "sm" && "text-lg",
                )}
              >
                {String(u.value).padStart(2, "0")}
              </span>
              <span className={cn("mt-1 uppercase tracking-[0.18em] text-current/60", size === "sm" ? "text-[0.55rem]" : "text-[0.62rem]")}>
                {u.label}
              </span>
            </div>
            {i < units.length - 1 && size !== "sm" && (
              <span aria-hidden="true" className="self-center font-display text-xl text-current/30">
                :
              </span>
            )}
          </div>
        ))}
      </div>
      {parts.days > 0 && (
        <p className="min-h-[1em] text-[0.7rem] text-current/55">{endLabel ? `Ends ${endLabel} (Malta time)` : "\u00a0"}</p>
      )}
    </div>
  );
}
