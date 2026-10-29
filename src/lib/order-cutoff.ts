/**
 * Weekly ordering deadline ("order before Wednesday 4pm for next week").
 * Pure and client-safe; all times are in the business time zone (Malta).
 *
 * Orders placed before the deadline are for the week starting the Monday
 * after it; orders placed later are for the week after that.
 */
import { addDaysToDateString, zonedDateString, zonedLocalToUtc } from "@/lib/time";

export interface CutoffConfig {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** "HH:MM", 24-hour */
  time: string;
}

export interface CutoffInfo {
  /** The deadline as a UTC instant. */
  cutoff: Date;
  /** Calendar day of the deadline (YYYY-MM-DD, business time zone). */
  cutoffDay: string;
  /** Monday of the week these orders are for (YYYY-MM-DD). */
  weekStart: string;
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const weekdayOf = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

/** Monday after a given day (never the same day). */
function mondayAfter(ymd: string): string {
  const delta = (1 - weekdayOf(ymd) + 7) % 7 || 7;
  return addDaysToDateString(ymd, delta);
}

/** The next deadline that hasn't passed yet, and the week it's for. */
export function nextCutoff(now: Date, cfg: Pick<CutoffConfig, "weekday" | "time">, timeZone: string): CutoffInfo {
  const today = zonedDateString(now, timeZone);
  let day = addDaysToDateString(today, (cfg.weekday - weekdayOf(today) + 7) % 7);
  let cutoff = zonedLocalToUtc(`${day}T${cfg.time}`, timeZone)!;
  if (cutoff.getTime() <= now.getTime()) {
    day = addDaysToDateString(day, 7);
    cutoff = zonedLocalToUtc(`${day}T${cfg.time}`, timeZone)!;
  }
  return { cutoff, cutoffDay: day, weekStart: mondayAfter(day) };
}

/** Earliest start date a customer may choose: the lead time and, if enabled, the weekly deadline. */
export function earliestStartDate(now: Date, cfg: CutoffConfig, leadTimeDays: number, timeZone: string): string {
  const byLeadTime = addDaysToDateString(zonedDateString(now, timeZone), leadTimeDays);
  if (!cfg.enabled) return byLeadTime;
  const { weekStart } = nextCutoff(now, cfg, timeZone);
  return weekStart > byLeadTime ? weekStart : byLeadTime;
}

/** "4pm", "4:30pm", "noon" */
export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (h === 12 && m === 0) return "noon";
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`;
}

/** "Wed 4 Nov" */
export function formatShortDay(ymd: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${ymd}T12:00:00Z`),
  );
}
