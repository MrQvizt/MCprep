import { z } from "zod";
import { parseMoneyToCents, percentToBasisPoints } from "@/lib/money";
import { SLUG_RE, isInstagramUrl } from "@/lib/urls";

/**
 * Reusable zod field builders for admin forms. Inputs arrive as strings from
 * FormData; blank optional values become null.
 */

export const requiredText = (label: string, max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

export const slugField = (label = "Web address") =>
  z
    .string()
    .trim()
    .toLowerCase()
    .min(2, `${label} is required.`)
    .max(80, `${label} must be 80 characters or fewer.`)
    .regex(SLUG_RE, "Use lower-case letters, numbers and hyphens only (e.g. chicken-pokebowl).");

/** Optional number (blank → null). */
export function optionalNumber(label: string, opts: { int?: boolean; min?: number; max?: number } = {}) {
  const { int = false, min = 0, max = 1_000_000 } = opts;
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v.replace(",", "."));
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: `${label} must be a number.` });
        return z.NEVER;
      }
      if (int && !Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number.` });
        return z.NEVER;
      }
      if (n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be between ${min} and ${max}.` });
        return z.NEVER;
      }
      return int ? n : Math.round(n * 10) / 10;
    });
}

export function requiredInt(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v);
      if (v === "" || !Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number.` });
        return z.NEVER;
      }
      if (n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be between ${min} and ${max}.` });
        return z.NEVER;
      }
      return n;
    });
}

/** Euro amount → cents (blank → null unless required). */
export function moneyField(label: string, required = false) {
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") {
        if (required) {
          ctx.addIssue({ code: "custom", message: `${label} is required.` });
          return z.NEVER;
        }
        return null;
      }
      const cents = parseMoneyToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `${label}: enter an amount like 12.50` });
        return z.NEVER;
      }
      return cents;
    });
}

/** "20" / "12.5" → basis points. */
export function percentField(label: string) {
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      const bps = percentToBasisPoints(v);
      if (bps === null) {
        ctx.addIssue({ code: "custom", message: `${label}: enter a percentage between 0.01 and 100.` });
        return z.NEVER;
      }
      return bps;
    });
}

/** Optional Instagram URL (blank → null). */
export const instagramUrlField = z
  .string()
  .trim()
  .max(500)
  .transform((v, ctx) => {
    if (v === "") return null;
    if (!isInstagramUrl(v)) {
      ctx.addIssue({ code: "custom", message: "Use a full Instagram link, e.g. https://www.instagram.com/p/…" });
      return z.NEVER;
    }
    return v;
  });

/** Newline or comma separated list → unique trimmed strings. */
export function splitList(value: string, max = 40): string[] {
  const items = value
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
  return [...new Set(items)].slice(0, max);
}

/** Lines only (features may contain commas). */
export function splitLines(value: string, max = 40): string[] {
  return value
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, max);
}

export const mediaIdField = z
  .string()
  .trim()
  .max(40)
  .transform((v) => (v === "" ? null : v));
