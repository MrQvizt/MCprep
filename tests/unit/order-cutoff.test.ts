import { describe, expect, it } from "vitest";
import { earliestStartDate, formatShortDay, formatTime12, nextCutoff } from "@/lib/order-cutoff";

const TZ = "Europe/Malta";
const WED_4PM = { enabled: true, weekday: 3, time: "16:00" };

describe("weekly ordering deadline (Wednesday 4pm, Malta)", () => {
  it("uses this week's Wednesday before the deadline", () => {
    // Monday 2 Nov 2026, 10:00 Malta (CET, UTC+1)
    const r = nextCutoff(new Date("2026-11-02T09:00:00Z"), WED_4PM, TZ);
    expect(r.cutoffDay).toBe("2026-11-04");
    expect(r.cutoff.toISOString()).toBe("2026-11-04T15:00:00.000Z");
    expect(r.weekStart).toBe("2026-11-09");
  });

  it("is still open one minute before 4pm on Wednesday", () => {
    expect(nextCutoff(new Date("2026-11-04T14:59:00Z"), WED_4PM, TZ).cutoffDay).toBe("2026-11-04");
  });

  it("moves to next week at 4pm on Wednesday", () => {
    const r = nextCutoff(new Date("2026-11-04T15:00:00Z"), WED_4PM, TZ);
    expect(r.cutoffDay).toBe("2026-11-11");
    expect(r.weekStart).toBe("2026-11-16");
  });

  it("works from later in the week and across daylight-saving time", () => {
    // Thursday 29 Oct 2026 → Wednesday 4 Nov
    expect(nextCutoff(new Date("2026-10-29T11:00:00Z"), WED_4PM, TZ).weekStart).toBe("2026-11-09");
    // Summer (CEST, UTC+2): 4pm Malta is 14:00 UTC
    expect(nextCutoff(new Date("2026-06-01T08:00:00Z"), WED_4PM, TZ).cutoff.toISOString()).toBe("2026-06-03T14:00:00.000Z");
  });

  it("sets the earliest start date to the first deliverable week", () => {
    const monday = new Date("2026-11-02T09:00:00Z");
    expect(earliestStartDate(monday, WED_4PM, 1, TZ)).toBe("2026-11-09");
    expect(earliestStartDate(monday, { ...WED_4PM, enabled: false }, 1, TZ)).toBe("2026-11-03");
    // A longer lead time still wins when it's later.
    expect(earliestStartDate(monday, WED_4PM, 14, TZ)).toBe("2026-11-16");
  });

  it("formats times and days for the notice", () => {
    expect(formatTime12("16:00")).toBe("4pm");
    expect(formatTime12("16:30")).toBe("4:30pm");
    expect(formatTime12("12:00")).toBe("noon");
    expect(formatTime12("00:00")).toBe("12am");
    expect(formatShortDay("2026-11-04")).toBe("Wed 4 Nov");
  });
});
