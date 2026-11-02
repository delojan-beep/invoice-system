// CSV for accounts exports. Opened in Excel or Google Sheets, so cells that
// start like a formula are prefixed with ' to stop them running.

export type Cell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Cell[][]): string {
  // CRLF line endings and a BOM so Excel opens UTF-8 (names, "Rs") correctly.
  return "﻿" + rows.map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

/** Minor units as a plain decimal for spreadsheets: 25000000, 2 places -> "250000.00". */
export function minorToDecimal(minor: number | null | undefined, places: number): string {
  if (minor === null || minor === undefined) return "";
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const scale = 10 ** places;
  const whole = Math.trunc(abs / scale);
  return places > 0 ? `${sign}${whole}.${String(abs % scale).padStart(places, "0")}` : `${sign}${whole}`;
}
