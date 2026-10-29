/**
 * Time-zone helpers. The database stores UTC; the business operates in
 * Europe/Malta (CET/CEST). Admin forms use local "YYYY-MM-DDTHH:mm" values in
 * the business time zone, converted here without external dependencies.
 */

export const DEFAULT_TIME_ZONE = "Europe/Malta";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function zonedParts(date: Date, timeZone: string = DEFAULT_TIME_ZONE): Parts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = parseInt(p.value, 10);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
export function timeZoneOffsetMs(date: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Interpret a wall-clock time in `timeZone` and return the UTC instant.
 * "2026-10-31T23:59" in Europe/Malta → 2026-10-31T22:59:00Z (CET, UTC+1).
 * For non-existent local times (spring-forward gap) the later offset is used.
 */
export function zonedLocalToUtc(local: string, timeZone: string = DEFAULT_TIME_ZONE): Date | null {
  const m = LOCAL_RE.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h = "0", mi = "0", s = "0"] = m.slice(1);
  const year = +y;
  const month = +mo;
  const day = +d;
  const hour = +h;
  const minute = +mi;
  const second = +s;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  // Reject impossible calendar dates such as 31 February.
  if (new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) return null;
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset1 = timeZoneOffsetMs(new Date(guess), timeZone);
  let result = guess - offset1;
  const offset2 = timeZoneOffsetMs(new Date(result), timeZone);
  if (offset2 !== offset1) result = guess - offset2;
  return new Date(result);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC instant → "YYYY-MM-DDTHH:mm" in the business time zone (for <input type="datetime-local">). */
export function utcToZonedInputValue(date: Date | null | undefined, timeZone: string = DEFAULT_TIME_ZONE): string {
  if (!date) return "";
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** UTC instant → "YYYY-MM-DD" calendar date in the business time zone. */
export function zonedDateString(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Add whole calendar days to a "YYYY-MM-DD" string. */
export function addDaysToDateString(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Start of the business-local day containing `date`, as a UTC instant. */
export function startOfZonedDay(date: Date, timeZone: string = DEFAULT_TIME_ZONE): Date {
  return zonedLocalToUtc(`${zonedDateString(date, timeZone)}T00:00`, timeZone)!;
}

export function formatDateTime(
  date: Date | string | null | undefined,
  timeZone: string = DEFAULT_TIME_ZONE,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", { timeZone, ...opts }).format(d);
}

export function formatDate(
  date: Date | string | null | undefined,
  timeZone: string = DEFAULT_TIME_ZONE,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
): string {
  return formatDateTime(date, timeZone, opts);
}

/** "YYYY-MM-DD" (date-only, no time zone) → "Mon 3 November 2026". */
export function formatCalendarDate(ymd: string | Date | null | undefined): string {
  if (!ymd) return "";
  const s = typeof ymd === "string" ? ymd : ymd.toISOString().slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatWeekdays(days: number[]): string {
  const sorted = [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  return sorted.map((d) => WEEKDAYS_SHORT[d]).join(", ");
}

export function timeZoneLabel(timeZone: string = DEFAULT_TIME_ZONE, date = new Date()): string {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  return name ? `${timeZone.replace("_", " ")} (${name})` : timeZone;
}
