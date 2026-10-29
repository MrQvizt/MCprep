import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildOrderWhere, parseOrderFilters } from "@/lib/admin/orders";
import { promotionState } from "@/lib/pricing";
import { getPricingPromotions } from "@/lib/promotions";
import {
  addOrderNoteAction,
  decideEligibilityAction,
  quickOrderStatus,
  updateOrderStatusAction,
  updatePricePaymentAction,
} from "@/app/admin/(dashboard)/orders/actions";
import { GET as exportOrdersCsv } from "@/app/api/admin/orders/export/route";
import { createPromotion, signInAs, signOutTest } from "./helpers";
import { createTestCustomer, createTestOrder } from "./admin-orders.fixtures";

function fd(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

const initial = { ok: false };

describe("admin order status updates", () => {
  it("records status history separately and sets timestamps", async () => {
    const admin = await signInAs("ADMIN");
    const order = await createTestOrder();

    expect((await quickOrderStatus(order.id, "CONTACTED")).ok).toBe(true);
    let updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("CONTACTED");
    expect(updated.contactedAt).not.toBeNull();
    expect(updated.confirmedAt).toBeNull();

    const res = await updateOrderStatusAction(order.id, initial, fd({ status: "CONFIRMED", note: "Agreed Sunday collection" }));
    expect(res.ok).toBe(true);
    updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("CONFIRMED");
    expect(updated.confirmedAt).not.toBeNull();

    await quickOrderStatus(order.id, "COMPLETED");
    updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.completedAt).not.toBeNull();

    const history = await db.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      ["NEW", "CONTACTED"],
      ["CONTACTED", "CONFIRMED"],
      ["CONFIRMED", "COMPLETED"],
    ]);
    expect(history[1].note).toBe("Agreed Sunday collection");
    expect(history.every((h) => h.changedById === admin.id)).toBe(true);

    const audits = await db.auditLog.count({ where: { entityId: order.id, action: "order.status" } });
    expect(audits).toBe(3);
  });

  it("refuses a no-op status change without a note", async () => {
    await signInAs("ADMIN");
    const order = await createTestOrder({ status: "CONTACTED" });
    const res = await quickOrderStatus(order.id, "CONTACTED");
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/already/);
    expect(await db.orderStatusHistory.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("cancelling frees the promotion redemption; re-opening reserves it again", async () => {
    await signInAs("ADMIN");
    const promo = await createPromotion({ audience: "NEW_CUSTOMERS", totalRedemptionLimit: 1 });
    const order = await createTestOrder({
      promotionId: promo.id,
      promotionName: promo.name,
      promotionAudience: "NEW_CUSTOMERS",
      discountCents: 2400,
      eligibilityStatus: "PRELIMINARY_ELIGIBLE",
      withRedemption: true,
    });
    let promos = await getPricingPromotions(new Date());
    expect(promotionState(promos.find((p) => p.id === promo.id)!, new Date())).toBe("LIMIT_REACHED");

    await quickOrderStatus(order.id, "CANCELLED");
    const cancelled = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { redemption: true } });
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.redemption?.status).toBe("CANCELLED");
    promos = await getPricingPromotions(new Date());
    expect(promotionState(promos.find((p) => p.id === promo.id)!, new Date())).toBe("ACTIVE");

    await quickOrderStatus(order.id, "NEW");
    const reopened = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { redemption: true } });
    expect(reopened.cancelledAt).toBeNull();
    expect(reopened.redemption?.status).toBe("REQUESTED");
  });

  it("keeps internal notes and the agreed price separate from the quoted snapshot", async () => {
    await signInAs("ADMIN");
    const order = await createTestOrder({ basePriceCents: 12000, discountCents: 2400 });
    expect((await addOrderNoteAction(order.id, initial, fd({ body: "Prefers evening calls" }))).ok).toBe(true);
    expect((await addOrderNoteAction(order.id, initial, fd({ body: "   " }))).ok).toBe(false);

    const res = await updatePricePaymentAction(order.id, initial, fd({ confirmedTotal: "110.50", paymentStatus: "PAID", paidAmount: "110.50" }));
    expect(res.ok).toBe(true);
    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { internalNotes: true } });
    expect(updated.internalNotes).toHaveLength(1);
    expect(updated.confirmedTotalCents).toBe(11050);
    expect(updated.paymentStatus).toBe("PAID");
    expect(updated.paidAt).not.toBeNull();
    expect(updated.paymentProvider).toBe("manual");
    // The quote snapshot is untouched.
    expect(updated.basePriceCents).toBe(12000);
    expect(updated.discountCents).toBe(2400);
    expect(updated.totalCents).toBe(9600);

    const bad = await updatePricePaymentAction(order.id, initial, fd({ confirmedTotal: "abc", paymentStatus: "PAID", paidAmount: "" }));
    expect(bad.ok).toBe(false);
    expect(bad.fieldErrors?.confirmedTotal).toBeTruthy();
  });
});

describe("promotion eligibility decisions", () => {
  it("approving updates the order, the review and the redemption with an audit trail", async () => {
    const admin = await signInAs("ADMIN");
    const promo = await createPromotion({ audience: "NEW_CUSTOMERS" });
    const order = await createTestOrder({
      promotionId: promo.id,
      promotionName: "Halloween Special",
      promotionAudience: "NEW_CUSTOMERS",
      discountCents: 2400,
      eligibilityStatus: "NEEDS_REVIEW",
      eligibilityReasons: ["EMAIL_MATCH"],
      withRedemption: true,
    });
    await db.promotionEligibilityReview.create({
      data: { orderId: order.id, promotionId: promo.id, automatedResult: "NEEDS_REVIEW", reasons: ["EMAIL_MATCH"] },
    });

    const res = await decideEligibilityAction(order.id, initial, fd({ decision: "APPROVED", note: "Checked DMs, first order" }));
    expect(res.ok).toBe(true);
    const updated = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { redemption: true, eligibilityReviews: true },
    });
    expect(updated.eligibilityStatus).toBe("APPROVED");
    expect(updated.redemption?.status).toBe("APPROVED");
    expect(updated.eligibilityReviews).toHaveLength(1);
    expect(updated.eligibilityReviews[0]).toMatchObject({
      automatedResult: "NEEDS_REVIEW",
      decision: "APPROVED",
      decidedById: admin.id,
      note: "Checked DMs, first order",
    });
    expect(await db.auditLog.count({ where: { entityId: order.id, action: "order.promotion_approve" } })).toBe(1);
  });

  it("rejecting creates a review when none exists and marks the redemption rejected", async () => {
    await signInAs("ADMIN");
    const promo = await createPromotion({ audience: "NEW_CUSTOMERS" });
    const order = await createTestOrder({
      promotionId: promo.id,
      promotionName: promo.name,
      promotionAudience: "NEW_CUSTOMERS",
      discountCents: 2400,
      eligibilityStatus: "LIKELY_INELIGIBLE",
      eligibilityReasons: ["PRIOR_CONFIRMED_ORDER"],
      withRedemption: true,
    });
    const res = await decideEligibilityAction(order.id, initial, fd({ decision: "REJECTED" }));
    expect(res.ok).toBe(true);
    const review = await db.promotionEligibilityReview.findFirstOrThrow({ where: { orderId: order.id } });
    expect(review).toMatchObject({ automatedResult: "LIKELY_INELIGIBLE", decision: "REJECTED" });
    expect(review.reasons).toEqual(["PRIOR_CONFIRMED_ORDER"]);
    const redemption = await db.promotionRedemption.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(redemption.status).toBe("REJECTED");
    // Pricing snapshot keeps the requested discount for the record.
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).discountCents).toBe(2400);
  });

  it("refuses a decision for orders without a promotion", async () => {
    await signInAs("ADMIN");
    const order = await createTestOrder();
    const res = await decideEligibilityAction(order.id, initial, fd({ decision: "APPROVED" }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/didn't request a promotion/);
  });
});

describe("order access control", () => {
  it("blocks signed-out users and content editors from order actions", async () => {
    const order = await createTestOrder();
    signOutTest();
    const anon = await quickOrderStatus(order.id, "CONTACTED");
    expect(anon.ok).toBe(false);
    expect(anon.message).toMatch(/session/i);

    await signInAs("EDITOR");
    const editor = await quickOrderStatus(order.id, "CONTACTED");
    expect(editor.ok).toBe(false);
    const note = await addOrderNoteAction(order.id, initial, fd({ body: "sneaky" }));
    expect(note.ok).toBe(false);

    const unchanged = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { internalNotes: true } });
    expect(unchanged.status).toBe("NEW");
    expect(unchanged.internalNotes).toHaveLength(0);
  });

  it("does not let editors or visitors export orders", async () => {
    await createTestOrder();
    signOutTest();
    expect((await exportOrdersCsv(new Request("https://mcpreps.test/api/admin/orders/export"))).status).toBe(401);
    await signInAs("EDITOR");
    expect((await exportOrdersCsv(new Request("https://mcpreps.test/api/admin/orders/export"))).status).toBe(401);
  });
});

describe("order filters and CSV export", () => {
  it("filters by search, status, eligibility and Malta date range", async () => {
    const customer = await createTestCustomer();
    const a = await createTestOrder({ customerName: "Maria Borg", status: "NEW", customerId: customer.id });
    await createTestOrder({ customerName: "Joe Camilleri", status: "CONFIRMED" });
    const promo = await createPromotion();
    const c = await createTestOrder({
      customerName: "Anna Vella",
      promotionId: promo.id,
      promotionName: promo.name,
      eligibilityStatus: "NEEDS_REVIEW",
    });
    // 31 Oct 2026 23:30 Malta time = 22:30 UTC
    const d = await createTestOrder({ customerName: "Late Order", createdAt: new Date("2026-10-31T22:30:00Z") });

    const find = async (sp: Record<string, string>) =>
      (await db.order.findMany({ where: buildOrderWhere(parseOrderFilters(sp)), select: { id: true } })).map((o) => o.id);

    expect(await find({ q: "maria" })).toEqual([a.id]);
    expect(await find({ q: a.reference.toLowerCase() })).toEqual([a.id]);
    expect((await find({ status: "CONFIRMED" })).length).toBe(1);
    expect(await find({ eligibility: "needs_review" })).toEqual([c.id]);
    expect(await find({ customer: customer.id })).toEqual([a.id]);
    expect(await find({ from: "2026-10-31", to: "2026-10-31" })).toEqual([d.id]);
    expect(await find({ from: "2026-11-01", to: "2026-11-01" })).toEqual([]);
    // Invalid values are ignored rather than breaking the query.
    expect(parseOrderFilters({ status: "HACKED", from: "yesterday" })).toMatchObject({ status: "", from: "" });
  });

  it("exports a CSV with formula protection and logs the export", async () => {
    await signInAs("ADMIN");
    await createTestOrder({ customerName: "=HYPERLINK(\"http://evil.test\",\"click\")", allergies: "Sesame, gluten" });
    const res = await exportOrdersCsv(new Request("https://mcpreps.test/api/admin/orders/export?status=NEW"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="mcpreps-orders-/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM for Excel
    const body = new TextDecoder().decode(bytes);
    expect(body.startsWith("Reference,")).toBe(true);
    expect(body).toContain(`"'=HYPERLINK(""http://evil.test"",""click"")"`);
    expect(body).toContain('"Sesame, gluten"');
    expect(body).toContain("120.00");
    expect(await db.auditLog.count({ where: { action: "order.export" } })).toBe(1);
  });
});
