import { describe, expect, it } from "vitest";
import {
  deleteDeliveryAreaAction,
  saveCollectionPoint,
  saveDeliveryAreaAction,
  saveFulfillmentSettings,
  setDeliveryAreasEnabledAction,
} from "@/app/admin/(dashboard)/delivery/actions";
import { deliveryAreaSchema, DeliveryValidationError, saveDeliveryArea, textSimilarity } from "@/lib/admin/delivery";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formData, words } from "./d2-helpers";
import { createDeliveryArea, signInAs } from "./helpers";

const base = {
  name: "Sliema",
  slug: "sliema",
  region: "MALTA",
  deliveryAvailable: true,
  isPublished: true,
  deliveryFee: "",
  minOrder: "",
  deliveryDays: [1, 4],
};

describe("delivery localities", () => {
  it("parses fees as cents and leaves blank fees empty", async () => {
    await signInAs("ADMIN");
    const area = await createDeliveryArea({ name: "Msida", slug: "msida" });
    const res = await saveDeliveryAreaAction(area.id, { ok: false }, formData({ ...base, name: "Msida", slug: "msida", deliveryFee: "3.50", minOrder: "" }));
    expect(res.ok).toBe(true);
    const row = await db.deliveryArea.findUniqueOrThrow({ where: { id: area.id } });
    expect(row.deliveryFeeCents).toBe(350);
    expect(row.minOrderCents).toBeNull();
    expect(row.deliveryDays).toEqual([1, 4]);
  });

  it("rejects an invalid fee", async () => {
    await signInAs("ADMIN");
    const area = await createDeliveryArea();
    const res = await saveDeliveryAreaAction(area.id, { ok: false }, formData({ ...base, deliveryFee: "three euro" }));
    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.deliveryFeeCents).toBeTruthy();
  });

  it("requires genuinely unique, substantial content before a locality gets its own page", () => {
    const thin = deliveryAreaSchema.safeParse({
      ...base,
      deliveryFeeCents: "",
      minOrderCents: "",
      deliveryWindow: "",
      notes: "",
      zone: "",
      hasPublicPage: true,
      pageIntro: "Meal prep delivery in Sliema, every week.",
      pageBody: "We deliver here.",
    });
    expect(thin.success).toBe(false);
    expect(thin.error?.issues.some((i) => i.path[0] === "pageBody")).toBe(true);

    const notDelivered = deliveryAreaSchema.safeParse({
      ...base,
      deliveryAvailable: false,
      deliveryFeeCents: "",
      minOrderCents: "",
      deliveryWindow: "",
      notes: "",
      zone: "",
      hasPublicPage: true,
      pageIntro: "Meal prep delivery in Sliema, every single week.",
      pageBody: words(200),
    });
    expect(notDelivered.success).toBe(false);
    expect(notDelivered.error?.issues.some((i) => i.path[0] === "hasPublicPage")).toBe(true);
  });

  it("blocks near-duplicate locality pages (doorway pages)", async () => {
    const admin = await signInAs("ADMIN");
    const body = words(200, "sliema");
    await createDeliveryArea({ name: "Sliema", slug: "sliema" }).then((a) =>
      db.deliveryArea.update({ where: { id: a.id }, data: { hasPublicPage: true, pageIntro: "x".repeat(50), pageBody: body } }),
    );
    expect(textSimilarity(body, body.replace("sliema1 ", "gzira1 "))).toBeGreaterThan(0.6);
    const parsed = deliveryAreaSchema.parse({
      ...base,
      name: "Gżira",
      slug: "gzira",
      deliveryFeeCents: "",
      minOrderCents: "",
      deliveryWindow: "",
      notes: "",
      zone: "",
      hasPublicPage: true,
      pageIntro: "Meal prep delivery in Gżira, cooked fresh every week.",
      pageBody: body.replace(/sliema/g, "gzira"),
    });
    // Same sentences with the town name swapped is still a duplicate.
    await expect(saveDeliveryArea(null, { ...parsed, pageBody: body }, admin)).rejects.toBeInstanceOf(DeliveryValidationError);
  });

  it("creates a 301 redirect when a public locality page changes address or is switched off", async () => {
    await signInAs("ADMIN");
    const area = await createDeliveryArea({ name: "St Julian's", slug: "st-julians" });
    const pageFields = { hasPublicPage: true, pageIntro: "Fresh macro-tracked meals delivered in St Julian's.", pageBody: words(180, "stj") };
    expect((await saveDeliveryAreaAction(area.id, { ok: false }, formData({ ...base, name: "St Julian's", slug: "st-julians", ...pageFields }))).ok).toBe(true);
    expect((await saveDeliveryAreaAction(area.id, { ok: false }, formData({ ...base, name: "St Julian's", slug: "san-giljan", ...pageFields }))).ok).toBe(true);
    const moved = await db.redirectRule.findUniqueOrThrow({ where: { fromPath: "/delivery-areas/st-julians" } });
    expect(moved).toMatchObject({ toPath: "/delivery-areas/san-giljan", statusCode: 301, isActive: true });

    expect((await saveDeliveryAreaAction(area.id, { ok: false }, formData({ ...base, name: "St Julian's", slug: "san-giljan" }))).ok).toBe(true);
    const off = await db.redirectRule.findUniqueOrThrow({ where: { fromPath: "/delivery-areas/san-giljan" } });
    expect(off.toPath).toBe("/delivery-areas");
    // The earlier rule was collapsed to avoid a redirect chain.
    expect((await db.redirectRule.findUniqueOrThrow({ where: { fromPath: "/delivery-areas/st-julians" } })).toPath).toBe("/delivery-areas");
  });

  it("switches several localities on and off together", async () => {
    await signInAs("ADMIN");
    const a = await createDeliveryArea({ name: "Mosta", slug: "mosta", deliveryAvailable: false, isPublished: false });
    const b = await createDeliveryArea({ name: "Naxxar", slug: "naxxar", deliveryAvailable: false, isPublished: false });
    expect((await setDeliveryAreasEnabledAction([a.id, b.id], true)).ok).toBe(true);
    expect(await db.deliveryArea.count({ where: { deliveryAvailable: true, isPublished: true } })).toBe(2);
    expect((await setDeliveryAreasEnabledAction([a.id], false)).ok).toBe(true);
    expect((await db.deliveryArea.findUniqueOrThrow({ where: { id: a.id } })).deliveryAvailable).toBe(false);
    expect(await db.auditLog.count({ where: { action: { in: ["deliveryArea.enable", "deliveryArea.disable"] } } })).toBe(2);
  });

  it("keeps the locality name on past orders when a locality is deleted", async () => {
    await signInAs("ADMIN");
    const area = await createDeliveryArea({ name: "Qormi", slug: "qormi" });
    expect((await deleteDeliveryAreaAction(area.id)).ok).toBe(true);
    expect(await db.deliveryArea.count({ where: { id: area.id } })).toBe(0);
  });
});

describe("collection points and fulfilment settings", () => {
  it("requires an address before showing it publicly", async () => {
    await signInAs("ADMIN");
    const res = await saveCollectionPoint(null, { ok: false }, formData({ name: "Kitchen", showAddressPublicly: true, isActive: true }));
    expect(res.ok).toBe(false);
    expect(res.fieldErrors?.address).toBeTruthy();
  });

  it("keeps at least one fulfilment method switched on and saves valid settings", async () => {
    await signInAs("ADMIN");
    const none = await saveFulfillmentSettings({ ok: false }, formData({ noDeliveryAreasMessage: "Message us about delivery.", leadTimeDays: 1 }));
    expect(none.ok).toBe(false);
    expect(none.fieldErrors?.deliveryEnabled).toBeTruthy();

    const okRes = await saveFulfillmentSettings(
      { ok: false },
      formData({ collectionEnabled: true, deliveryInfo: "We deliver on set days.", noDeliveryAreasMessage: "Message us about delivery.", leadTimeDays: 2 }),
    );
    expect(okRes.ok).toBe(true);
    const settings = await getSettings();
    expect(settings.fulfillment).toMatchObject({ collectionEnabled: true, deliveryEnabled: false, leadTimeDays: 2, deliveryInfo: "We deliver on set days." });
  });
});
