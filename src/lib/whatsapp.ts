import { normalizePhone, phoneDigits } from "@/lib/identity";

/** Build a wa.me click-to-chat link. Returns null when the number is not configured/valid. */
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  const e164 = normalizePhone(phone);
  if (!e164) return null;
  const base = `https://wa.me/${phoneDigits(e164)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Replace {placeholders} in a message template with values. */
export function fillTemplate(template: string, values: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key];
    return v === null || v === undefined ? "" : String(v);
  });
}
