// Local-time helpers for scheduled jobs. Schedules are set in someone's own
// timezone (8:00 AM for the CEO, 6:30 PM Sri Lanka time on the 15th); the
// cron runs every 15 minutes in UTC and asks "has that local time arrived?".

export type LocalTime = {
  date: string; // YYYY-MM-DD in that timezone
  month: string; // YYYY-MM
  day: number; // day of month
  minutes: number; // minutes since local midnight
};

export function localTime(now: Date, timeZone: string): LocalTime {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    month: `${parts.year}-${parts.month}`,
    day: Number(parts.day),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** "08:00" -> 480. Invalid values fall back to the given default. */
export function parseClock(value: unknown, fallback: string): number {
  const text = typeof value === "string" ? value : fallback;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text) ?? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(fallback)!;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Has today's local time `at` (minutes) arrived? */
export function isDailyDue(now: Date, timeZone: string, at: number) {
  return localTime(now, timeZone).minutes >= at;
}

/** Has this month's day `day` at `at` arrived (local)? On or after that moment, for the rest of the month. */
export function isMonthlyDue(now: Date, timeZone: string, day: number, at: number) {
  const local = localTime(now, timeZone);
  return local.day > day || (local.day === day && local.minutes >= at);
}

/** The local date of an instant, for "already sent today?" checks. */
export function localDate(iso: string, timeZone: string) {
  return localTime(new Date(iso), timeZone).date;
}
