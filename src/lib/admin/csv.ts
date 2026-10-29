/**
 * CSV helpers with spreadsheet formula-injection protection.
 * Cells starting with = + - @ (or tab/CR) are prefixed with an apostrophe so
 * Excel/Sheets treat them as text — except plain numbers such as "-12.50" or
 * phone numbers like "+356 7912 3456", which cannot contain a formula.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?[\d\s.,()]+$/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === "boolean") s = value ? "Yes" : "No";
  else s = String(value);
  if (FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s) || s !== s.trim()) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

/** Full CSV document (UTF-8 BOM so Excel shows accents like "Gżira" correctly). */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return `\uFEFF${[csvRow(headers), ...rows.map(csvRow)].join("\r\n")}\r\n`;
}

/** Cents → "120.00" (no currency symbol, for spreadsheets). */
export function centsForCsv(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
