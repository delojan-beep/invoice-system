// Dates are stored in UTC and shown in the viewer's own timezone.

/** "2026-10-01" -> "October 2026". Invoice months are calendar dates, not instants. */
export function formatMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Oct 25, 2026" in the viewer's timezone. */
export function formatDate(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone });
}

/** "Oct 25, 2026, 3:04 PM" in the viewer's timezone. */
export function formatDateTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

/** 20480 -> "20 KB". */
export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
