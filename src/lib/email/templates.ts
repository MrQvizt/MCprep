import { formatMoney } from "@/lib/money";
import { ELIGIBILITY_LABELS, ELIGIBILITY_REASON_LABELS, FULFILLMENT_LABELS } from "@/lib/orders/labels";
import { formatCalendarDate, formatDateTime } from "@/lib/time";
import { escapeHtml, escapeMultiline, safeHeader } from "./escape";

export interface OrderEmailData {
  reference: string;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  whatsappNumber: string | null;
  planName: string;
  planDurationDays: number;
  planMealsIncluded: number | null;
  /** Packages: "Lunch + Dinner · 5 days". */
  packageLabel?: string | null;
  planIsSubscription?: boolean;
  planMealsPerWeek?: number | null;
  /** Dishes chosen per week. */
  mealSelections?: { name: string; quantity: number }[];
  currency: string;
  basePriceCents: number | null;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number | null;
  promotionName: string | null;
  promotionCode: string | null;
  promotionEndsAt: Date | null;
  promotionRequiresVerification: boolean;
  eligibilityStatus: string;
  eligibilityReasons: string[];
  isReturningCustomer: boolean;
  isPotentialDuplicate: boolean;
  fulfillmentMethod: "COLLECTION" | "DELIVERY";
  deliveryLocality: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  collectionPointName: string | null;
  preferredStartDate: string | null; // YYYY-MM-DD
  mealPreference: string | null;
  dietaryPreferences: string | null;
  allergies: string | null;
  specialInstructions: string | null;
  notes: string | null;
  marketingOptIn: boolean;
}

export interface EmailBrand {
  tradingName: string;
  timeZone: string;
  publicEmail: string;
  phone: string;
  whatsappLink: string | null;
  instagramUrl: string;
  siteUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const money = (cents: number | null, currency: string) =>
  cents === null ? "Price confirmed on request" : formatMoney(cents, currency);

function layout(brand: EmailBrand, preheader: string, body: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(brand.tradingName)}</title></head>
<body style="margin:0;padding:0;background:#f3f3f3;font-family:Helvetica,Arial,sans-serif;color:#080808;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f3;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;">
<tr><td style="background:#080808;padding:22px 28px;">
<span style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:2px;">${escapeHtml(brand.tradingName.toUpperCase())}</span>
</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.55;">${body}</td></tr>
<tr><td style="padding:18px 28px;background:#080808;color:#a3a3a3;font-size:12px;line-height:1.5;">
${escapeHtml(brand.tradingName)} · Malta${brand.publicEmail ? ` · ${escapeHtml(brand.publicEmail)}` : ""}${brand.phone ? ` · ${escapeHtml(brand.phone)}` : ""}
</td></tr>
</table></td></tr></table></body></html>`;
}

function row(label: string, value: string | null | undefined, raw = false) {
  if (!value) return "";
  return `<tr><td style="padding:7px 0;color:#595959;vertical-align:top;width:42%;font-size:14px;">${escapeHtml(label)}</td><td style="padding:7px 0;font-size:14px;font-weight:600;">${raw ? value : escapeMultiline(value)}</td></tr>`;
}

function table(rows: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e3e3e3;border-bottom:1px solid #e3e3e3;margin:16px 0;">${rows}</table>`;
}

function textLines(lines: [string, string | null | undefined][]) {
  return lines
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function fulfilmentSummary(o: OrderEmailData): string {
  if (o.fulfillmentMethod === "COLLECTION") {
    return `Collection${o.collectionPointName ? ` — ${o.collectionPointName}` : ""}`;
  }
  const address = [o.addressLine1, o.addressLine2, o.deliveryLocality, o.postalCode].filter(Boolean).join(", ");
  return `Delivery — ${address}`;
}

function planSummary(o: OrderEmailData) {
  if (o.packageLabel) {
    const perWeek = o.planMealsPerWeek ? `${o.planMealsPerWeek} meals a week` : null;
    const billing = o.planIsSubscription
      ? `Monthly subscription (renews every ${Math.max(1, Math.round(o.planDurationDays / 7))} weeks)`
      : "One week";
    return [o.packageLabel, perWeek, billing].filter(Boolean).join(" · ");
  }
  const parts = [`${o.planName} (${o.planDurationDays} days)`];
  if (o.planMealsIncluded) parts.push(`${o.planMealsIncluded} meals`);
  return parts.join(" · ");
}

/** "2× Chicken Poke Bowl, 3× Mexican Beef Bowl" (per week). */
export function dishesSummary(o: Pick<OrderEmailData, "mealSelections">): string | null {
  if (!o.mealSelections?.length) return null;
  return o.mealSelections.map((m) => `${m.quantity}× ${m.name}`).join(", ") + " (per week)";
}

function renewalNote(o: OrderEmailData): string | null {
  if (!o.planIsSubscription || o.basePriceCents === null) return null;
  return `${formatMoney(o.basePriceCents, o.currency)} every ${Math.max(1, Math.round(o.planDurationDays / 7))} weeks after the first period`;
}

// ── Business notification ───────────────────────────────────────────────────

export function renderBusinessOrderEmail(o: OrderEmailData, brand: EmailBrand, adminOrderUrl: string): RenderedEmail {
  const needsReview = o.promotionRequiresVerification && o.promotionName !== null;
  const subject = safeHeader(
    `New Order Request — ${o.reference}${needsReview ? " (promotion needs verification)" : ""}`,
  );
  const flags: string[] = [];
  if (needsReview) flags.push(`Promotion eligibility: ${ELIGIBILITY_LABELS[o.eligibilityStatus] ?? o.eligibilityStatus}`);
  if (o.isReturningCustomer) flags.push("Returning customer");
  if (o.isPotentialDuplicate) flags.push("Possible duplicate — another open request exists for this customer");
  const reasons = o.eligibilityReasons.map((r) => ELIGIBILITY_REASON_LABELS[r] ?? r);

  const alert =
    flags.length > 0
      ? `<div style="border:2px solid #080808;padding:12px 14px;margin:0 0 16px;font-size:14px;"><strong>Check before confirming:</strong><br>${flags
          .map(escapeHtml)
          .join("<br>")}${reasons.length ? `<br><span style="color:#595959;">${reasons.map(escapeHtml).join("<br>")}</span>` : ""}</div>`
      : "";

  const pricing = table(
    row("Plan price", money(o.basePriceCents, o.currency)) +
      (o.promotionName
        ? row(
            needsReview ? "Requested discount" : "Discount",
            `−${formatMoney(o.discountCents, o.currency)} (${o.promotionName}${o.promotionCode ? `, code ${o.promotionCode}` : ""})`,
          )
        : "") +
      (o.deliveryFeeCents > 0 ? row("Delivery fee", formatMoney(o.deliveryFeeCents, o.currency)) : "") +
      row(needsReview ? "Quoted total (if eligible)" : "Quoted total", money(o.totalCents, o.currency)) +
      (needsReview && o.basePriceCents !== null
        ? row("Total without promotion", money(o.basePriceCents + o.deliveryFeeCents, o.currency))
        : "") +
      (o.promotionEndsAt ? row("Offer ends", formatDateTime(o.promotionEndsAt, brand.timeZone)) : "") +
      row("Subscription", renewalNote(o)) +
      row("Payment", "Not collected — arrange with the customer"),
  );

  const html = layout(
    brand,
    `New order request ${o.reference} from ${o.customerName}`,
    `<h1 style="margin:0 0 6px;font-size:22px;">New order request</h1>
<p style="margin:0 0 16px;color:#595959;">${escapeHtml(o.reference)} · received ${escapeHtml(formatDateTime(o.createdAt, brand.timeZone))}</p>
${alert}
<h2 style="font-size:15px;margin:20px 0 0;text-transform:uppercase;letter-spacing:1px;">Customer</h2>
${table(
  row("Name", o.customerName) +
    row("Email", o.customerEmail) +
    row("Phone", o.customerPhone) +
    row("WhatsApp", o.whatsappNumber) +
    row("Marketing emails", o.marketingOptIn ? "Opted in" : "Not opted in"),
)}
<h2 style="font-size:15px;margin:20px 0 0;text-transform:uppercase;letter-spacing:1px;">Order</h2>
${table(
  row("Package", planSummary(o)) +
    row("Dishes", dishesSummary(o)) +
    row("Fulfilment", fulfilmentSummary(o)) +
    row("Preferred start", o.preferredStartDate ? formatCalendarDate(o.preferredStartDate) : null) +
    row("Meal preference", o.mealPreference) +
    row("Dietary preferences", o.dietaryPreferences) +
    row("Allergies / intolerances", o.allergies) +
    row("Special instructions", o.specialInstructions) +
    row("Notes", o.notes),
)}
<h2 style="font-size:15px;margin:20px 0 0;text-transform:uppercase;letter-spacing:1px;">Pricing</h2>
${pricing}
<p style="margin:24px 0 0;"><a href="${escapeHtml(adminOrderUrl)}" style="display:inline-block;background:#080808;color:#ffffff;text-decoration:none;padding:12px 20px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px;">Open in admin</a></p>`,
  );

  const text = [
    `New order request ${o.reference}`,
    `Received: ${formatDateTime(o.createdAt, brand.timeZone)}`,
    flags.length ? `\nCHECK BEFORE CONFIRMING:\n- ${flags.join("\n- ")}${reasons.length ? `\n  ${reasons.join("\n  ")}` : ""}` : "",
    "\nCUSTOMER",
    textLines([
      ["Name", o.customerName],
      ["Email", o.customerEmail],
      ["Phone", o.customerPhone],
      ["WhatsApp", o.whatsappNumber],
      ["Marketing emails", o.marketingOptIn ? "Opted in" : "Not opted in"],
    ]),
    "\nORDER",
    textLines([
      ["Package", planSummary(o)],
      ["Dishes", dishesSummary(o)],
      ["Fulfilment", fulfilmentSummary(o)],
      ["Preferred start", o.preferredStartDate ? formatCalendarDate(o.preferredStartDate) : null],
      ["Meal preference", o.mealPreference],
      ["Dietary preferences", o.dietaryPreferences],
      ["Allergies / intolerances", o.allergies],
      ["Special instructions", o.specialInstructions],
      ["Notes", o.notes],
    ]),
    "\nPRICING",
    textLines([
      ["Plan price", money(o.basePriceCents, o.currency)],
      [
        needsReview ? "Requested discount" : "Discount",
        o.promotionName ? `-${formatMoney(o.discountCents, o.currency)} (${o.promotionName})` : null,
      ],
      ["Delivery fee", o.deliveryFeeCents > 0 ? formatMoney(o.deliveryFeeCents, o.currency) : null],
      [needsReview ? "Quoted total (if eligible)" : "Quoted total", money(o.totalCents, o.currency)],
      ["Offer ends", o.promotionEndsAt ? formatDateTime(o.promotionEndsAt, brand.timeZone) : null],
      ["Subscription", renewalNote(o)],
      ["Payment", "Not collected"],
    ]),
    `\nOpen in admin: ${adminOrderUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

// ── Customer confirmation ───────────────────────────────────────────────────

export function renderCustomerOrderEmail(o: OrderEmailData, brand: EmailBrand): RenderedEmail {
  const firstName = o.customerName.split(/\s+/)[0] || o.customerName;
  const subject = safeHeader(`We've received your order request — ${o.reference}`);
  const promoNote =
    o.promotionName && o.promotionRequiresVerification
      ? `<p style="margin:12px 0;">You requested the <strong>${escapeHtml(o.promotionName)}</strong> offer. Offer eligibility is confirmed by our team, so your final amount will be confirmed when we contact you.</p>`
      : "";
  const allergyNote = o.allergies
    ? `<p style="margin:12px 0;">We've noted the allergy or intolerance information you gave us and will go through it with you before confirming.</p>`
    : "";

  const pricingRows =
    row("Package", planSummary(o)) +
    row("Dishes", dishesSummary(o)) +
    row("Fulfilment", o.fulfillmentMethod === "DELIVERY" ? `Delivery — ${o.deliveryLocality ?? ""}` : FULFILLMENT_LABELS.COLLECTION) +
    row("Preferred start", o.preferredStartDate ? formatCalendarDate(o.preferredStartDate) : null) +
    row("Plan price", money(o.basePriceCents, o.currency)) +
    (o.promotionName && o.discountCents > 0
      ? row(o.promotionRequiresVerification ? "Requested offer" : "Offer", `−${formatMoney(o.discountCents, o.currency)} (${o.promotionName})`)
      : "") +
    (o.deliveryFeeCents > 0 ? row("Delivery fee", formatMoney(o.deliveryFeeCents, o.currency)) : "") +
    row(o.promotionRequiresVerification ? "Estimated total" : "Quoted total", money(o.totalCents, o.currency)) +
    row("Then", renewalNote(o));

  const contactLines = [
    brand.whatsappLink ? `<a href="${escapeHtml(brand.whatsappLink)}" style="color:#080808;">WhatsApp</a>` : null,
    brand.publicEmail ? `<a href="mailto:${escapeHtml(brand.publicEmail)}" style="color:#080808;">${escapeHtml(brand.publicEmail)}</a>` : null,
    brand.instagramUrl ? `<a href="${escapeHtml(brand.instagramUrl)}" style="color:#080808;">Instagram</a>` : null,
  ].filter(Boolean);

  const html = layout(
    brand,
    `Order request ${o.reference} received — no payment has been taken.`,
    `<h1 style="margin:0 0 12px;font-size:22px;">Thanks, ${escapeHtml(firstName)} — request received.</h1>
<p style="margin:0 0 12px;">Your order request <strong>${escapeHtml(o.reference)}</strong> is pending confirmation. <strong>No payment has been taken.</strong> Our team will contact you to confirm availability, ${o.fulfillmentMethod === "DELIVERY" ? "delivery" : "collection"} details and payment.</p>
${promoNote}${allergyNote}
${table(pricingRows)}
${contactLines.length ? `<p style="margin:16px 0 0;">Questions? Reach us via ${contactLines.join(" · ")}.</p>` : ""}`,
  );

  const text = [
    `Thanks, ${firstName} — request received.`,
    `Your order request ${o.reference} is pending confirmation. No payment has been taken.`,
    `Our team will contact you to confirm availability, ${o.fulfillmentMethod === "DELIVERY" ? "delivery" : "collection"} details and payment.`,
    o.promotionName && o.promotionRequiresVerification
      ? `You requested the ${o.promotionName} offer. Eligibility is confirmed by our team, so your final amount will be confirmed when we contact you.`
      : "",
    "",
    textLines([
      ["Package", planSummary(o)],
      ["Dishes", dishesSummary(o)],
      ["Preferred start", o.preferredStartDate ? formatCalendarDate(o.preferredStartDate) : null],
      ["Plan price", money(o.basePriceCents, o.currency)],
      ["Offer", o.promotionName && o.discountCents > 0 ? `-${formatMoney(o.discountCents, o.currency)} (${o.promotionName})` : null],
      ["Delivery fee", o.deliveryFeeCents > 0 ? formatMoney(o.deliveryFeeCents, o.currency) : null],
      [o.promotionRequiresVerification ? "Estimated total" : "Quoted total", money(o.totalCents, o.currency)],
      ["Then", renewalNote(o)],
    ]),
    brand.publicEmail ? `\nQuestions? Email ${brand.publicEmail}` : "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { subject, html, text };
}

export function renderTestEmail(brand: EmailBrand): RenderedEmail {
  return {
    subject: safeHeader(`${brand.tradingName} — test email`),
    html: layout(brand, "Test email", `<h1 style="margin:0 0 12px;font-size:22px;">Email delivery works.</h1><p>This is a test email sent from your website's admin portal. Order notifications will arrive the same way.</p>`),
    text: "Email delivery works. This is a test email sent from your website's admin portal.",
  };
}

export function renderPasswordResetEmail(brand: EmailBrand, name: string, link: string): RenderedEmail {
  const firstName = name.split(/\s+/)[0] || name;
  return {
    subject: safeHeader(`Reset your ${brand.tradingName} password`),
    html: layout(
      brand,
      "Use this link within an hour to choose a new password.",
      `<h1 style="margin:0 0 12px;font-size:22px;">Hi ${escapeHtml(firstName)},</h1>
<p style="margin:0 0 16px;">Someone (hopefully you) asked to reset the password for your ${escapeHtml(brand.tradingName)} account. The link works once, for the next hour.</p>
<p style="margin:24px 0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#080808;color:#ffffff;text-decoration:none;padding:12px 20px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px;">Choose a new password</a></p>
<p style="margin:0;color:#595959;font-size:13px;">If you didn't ask for this, you can ignore this email — your password stays the same.</p>`,
    ),
    text: `Hi ${firstName},\n\nUse this link within an hour to choose a new password for your ${brand.tradingName} account:\n${link}\n\nIf you didn't ask for this, ignore this email — your password stays the same.`,
  };
}
