import { describe, expect, it } from "vitest";
import { isDailyDue, isMonthlyDue, localDate, localTime, parseClock } from "./clock";

describe("localTime", () => {
  it("reads the wall clock in a timezone", () => {
    const now = new Date("2026-10-15T13:00:00Z");
    expect(localTime(now, "Asia/Colombo")).toEqual({ date: "2026-10-15", month: "2026-10", day: 15, minutes: 18 * 60 + 30 });
    expect(localTime(now, "America/Toronto")).toEqual({ date: "2026-10-15", month: "2026-10", day: 15, minutes: 9 * 60 });
  });

  it("crosses midnight into the next day ahead of UTC", () => {
    expect(localTime(new Date("2026-10-31T19:00:00Z"), "Asia/Colombo").date).toBe("2026-11-01");
  });
});

describe("parseClock", () => {
  it("reads HH:MM and falls back on bad input", () => {
    expect(parseClock("08:00", "08:00")).toBe(480);
    expect(parseClock("18:30", "08:00")).toBe(1110);
    expect(parseClock("25:00", "08:00")).toBe(480);
    expect(parseClock(null, "07:15")).toBe(435);
  });
});

describe("isDailyDue (CEO summary at 8:00 AM Toronto)", () => {
  const at = parseClock("08:00", "08:00");
  it("is not due before 8 local", () => {
    expect(isDailyDue(new Date("2026-10-28T11:59:00Z"), "America/Toronto", at)).toBe(false); // 7:59 EDT
  });
  it("is due from 8 local onwards", () => {
    expect(isDailyDue(new Date("2026-10-28T12:00:00Z"), "America/Toronto", at)).toBe(true); // 8:00 EDT
    expect(isDailyDue(new Date("2026-10-28T20:00:00Z"), "America/Toronto", at)).toBe(true);
  });
  it("follows daylight saving: 8:00 is 13:00 UTC after clocks go back", () => {
    expect(isDailyDue(new Date("2026-11-02T12:30:00Z"), "America/Toronto", at)).toBe(false); // 7:30 EST
    expect(isDailyDue(new Date("2026-11-02T13:00:00Z"), "America/Toronto", at)).toBe(true);
  });
});

describe("isMonthlyDue (15th at 6:30 PM Sri Lanka time)", () => {
  const at = parseClock("18:30", "18:30");
  it("is not due before the moment", () => {
    expect(isMonthlyDue(new Date("2026-10-15T12:59:00Z"), "Asia/Colombo", 15, at)).toBe(false); // 18:29
    expect(isMonthlyDue(new Date("2026-10-14T20:00:00Z"), "Asia/Colombo", 15, at)).toBe(false); // 15th 01:30
  });
  it("is due from then until the month ends", () => {
    expect(isMonthlyDue(new Date("2026-10-15T13:00:00Z"), "Asia/Colombo", 15, at)).toBe(true); // 18:30
    expect(isMonthlyDue(new Date("2026-10-20T00:00:00Z"), "Asia/Colombo", 15, at)).toBe(true);
  });
});

describe("localDate", () => {
  it("dates an instant in a timezone", () => {
    expect(localDate("2026-10-28T03:00:00Z", "America/Toronto")).toBe("2026-10-27");
    expect(localDate("2026-10-28T03:00:00Z", "Asia/Colombo")).toBe("2026-10-28");
  });
});
