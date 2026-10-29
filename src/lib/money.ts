/**
 * Money helpers. All amounts are integer minor units (cents). Never use
 * floating point arithmetic on money — convert at the edges only.
 */

export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_LOCALE = "en-MT";

export function formatMoney(
  cents: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  opts: { locale?: string; hideZeroDecimals?: boolean } = {},
): string {
  if (cents === null || cents === undefined) return "";
  const locale = opts.locale ?? DEFAULT_LOCALE;
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: opts.hideZeroDecimals && whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Parse a user-entered amount ("12", "12.5", "12,50", "€12.50") into cents.
 * Returns null for empty/invalid input. Uses string arithmetic — no floats.
 */
export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 100);
  }
  const cleaned = input.replace(/[€\s]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const euros = parseInt(match[1], 10);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return euros * 100 + parseInt(fraction || "0", 10);
}

/** "12.50" style value for form inputs. */
export function centsToInputValue(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Basis points (2000) → "20" / "12.5" percentage label. */
export function basisPointsToPercentLabel(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  if (frac === 0) return `${whole}`;
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/** "20" / "12.5" → 2000 / 1250 basis points. */
export function percentToBasisPoints(input: string | number): number | null {
  const s = String(input).trim().replace(",", ".").replace("%", "");
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(s);
  if (!match) return null;
  const bps = parseInt(match[1], 10) * 100 + parseInt((match[2] ?? "").padEnd(2, "0") || "0", 10);
  if (bps <= 0 || bps > 10000) return null;
  return bps;
}
