import { centsForCsv, toCsv } from "@/lib/admin/csv";
import { buildOrderWhere, CSV_EXPORT_LIMIT, parseOrderFilters } from "@/lib/admin/orders";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin, AuthorizationError } from "@/lib/authz";
import { db } from "@/lib/db";
import { ELIGIBILITY_LABELS, FULFILLMENT_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders/labels";
import { getSettings } from "@/lib/settings";
import { formatCalendarDate, formatDateTime, zonedDateString } from "@/lib/time";

const HEADERS = [
  "Reference",
  "Received (Malta time)",
  "Status",
  "Payment",
  "Customer name",
  "Email",
  "Phone",
  "WhatsApp",
  "Plan",
  "Plan days",
  "Fulfilment",
  "Locality",
  "Address",
  "Postcode",
  "Collection point",
  "Preferred start",
  "Plan price",
  "Discount",
  "Delivery fee",
  "Quoted total",
  "Agreed total",
  "Currency",
  "Promotion",
  "Promotion code",
  "Promotion eligibility",
  "Returning customer",
  "Possible duplicate",
  "Marketing opt-in",
  "Meal preference",
  "Dietary preferences",
  "Allergies",
  "Special instructions",
  "Customer notes",
  "Campaign source",
  "Campaign",
];

/** CSV export of orders (same filters as the Orders page). Admin-only and audit-logged. */
export async function GET(request: Request) {
  let admin;
  try {
    admin = await assertAdmin(AREA_ROLES.orders);
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Not authorised", { status: 401 });
    throw error;
  }
  const url = new URL(request.url);
  const filters = parseOrderFilters(url.searchParams);
  const settings = await getSettings();
  const tz = settings.business.timeZone;
  const orders = await db.order.findMany({
    where: buildOrderWhere(filters, tz),
    orderBy: { createdAt: "desc" },
    take: CSV_EXPORT_LIMIT,
  });

  const rows = orders.map((o) => [
    o.reference,
    formatDateTime(o.createdAt, tz, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    ORDER_STATUS_LABELS[o.status],
    PAYMENT_STATUS_LABELS[o.paymentStatus] ?? o.paymentStatus,
    o.customerName,
    o.customerEmail,
    o.customerPhone,
    o.whatsappNumber,
    o.planName,
    o.planDurationDays,
    FULFILLMENT_LABELS[o.fulfillmentMethod],
    o.deliveryLocality,
    [o.addressLine1, o.addressLine2].filter(Boolean).join(", "),
    o.postalCode,
    o.collectionPointName,
    o.preferredStartDate ? formatCalendarDate(o.preferredStartDate.toISOString().slice(0, 10)) : "",
    centsForCsv(o.basePriceCents),
    centsForCsv(o.discountCents),
    centsForCsv(o.deliveryFeeCents),
    centsForCsv(o.totalCents),
    centsForCsv(o.confirmedTotalCents),
    o.currency,
    o.promotionName,
    o.promotionCode,
    o.promotionName ? (ELIGIBILITY_LABELS[o.eligibilityStatus] ?? o.eligibilityStatus) : "",
    o.isReturningCustomer,
    o.isPotentialDuplicate,
    o.marketingOptIn,
    o.mealPreference,
    o.dietaryPreferences,
    o.allergies,
    o.specialInstructions,
    o.notes,
    o.utmSource ?? o.referrerHost,
    o.utmCampaign,
  ]);

  await logAudit({
    actor: admin,
    action: "order.export",
    entityType: "Order",
    summary: `Exported ${orders.length} order${orders.length === 1 ? "" : "s"} to CSV`,
    changes: { filters: url.searchParams.toString() },
  });

  const filename = `mcpreps-orders-${zonedDateString(new Date(), tz)}.csv`;
  return new Response(toCsv(HEADERS, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
