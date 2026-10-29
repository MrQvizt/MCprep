/** Client-safe promotion text helpers. */

export function discountShortLabel(discountType: string, discountValue: number, currency = "EUR"): string {
  if (discountType === "PERCENTAGE") {
    const pct = discountValue / 100;
    return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0$/, "")}%`;
  }
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency,
    minimumFractionDigits: discountValue % 100 === 0 ? 0 : 2,
  }).format(discountValue / 100);
}

export function formatPromoText(
  text: string | null | undefined,
  promo: { discountLabel?: string; discountType?: string; discountValue?: number; endsAt?: string | Date },
  timeZone = "Europe/Malta",
): string {
  if (!text) return "";
  const discount =
    promo.discountType && promo.discountValue !== undefined
      ? discountShortLabel(promo.discountType, promo.discountValue)
      : (promo.discountLabel ?? "").replace(/\s*off$/i, "");
  const ends = promo.endsAt
    ? new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(
        new Date(promo.endsAt),
      )
    : "";
  return text.replace(/\{discount\}/g, discount).replace(/\{ends\}/g, ends);
}
