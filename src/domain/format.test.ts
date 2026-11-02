import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatFileSize, formatMonth } from "./format";

describe("format", () => {
  it("names invoice months without timezone drift", () => {
    expect(formatMonth("2026-10-01")).toBe("October 2026");
    expect(formatMonth("2027-01-01")).toBe("January 2027");
  });

  it("shows instants in the viewer's timezone", () => {
    // 20:00 UTC on Oct 25 is already Oct 26 in Colombo (UTC+5:30)
    const iso = "2026-10-25T20:00:00Z";
    expect(formatDate(iso, "America/Toronto")).toBe("Oct 25, 2026");
    expect(formatDate(iso, "Asia/Colombo")).toBe("Oct 26, 2026");
    expect(formatDateTime(iso, "Asia/Colombo")).toBe("Oct 26, 2026, 1:30 AM");
  });

  it("formats file sizes", () => {
    expect(formatFileSize(20480)).toBe("20 KB");
    expect(formatFileSize(300)).toBe("1 KB");
    expect(formatFileSize(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});
