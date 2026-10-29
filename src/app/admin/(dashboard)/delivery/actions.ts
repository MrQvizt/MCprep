"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, fromZodError, handleActionError, ok, type ActionState } from "@/lib/actions";
import {
  collectionPointFormValues,
  collectionPointSchema,
  deleteDeliveryArea,
  DeliveryValidationError,
  deliveryAreaFormValues,
  deliveryAreaSchema,
  fulfillmentFormSchema,
  fulfillmentFormValues,
  saveDeliveryArea,
  setDeliveryAreasEnabled,
} from "@/lib/admin/delivery";
import { moveItem, nextSortOrder } from "@/lib/admin/reorder";
import { diffObjects, logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { revalidatePublicSite } from "@/lib/revalidate";
import { parseSettings, updateSettingsGroup } from "@/lib/settings";

function refresh() {
  revalidatePath("/admin/delivery", "layout");
  revalidatePublicSite();
}

// ── Fulfilment settings ─────────────────────────────────────────────────────

export async function saveFulfillmentSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.delivery);
    const parsed = fulfillmentFormSchema.safeParse(fulfillmentFormValues(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    const before = parseSettings("fulfillment", (await db.siteSetting.findUnique({ where: { key: "fulfillment" } }))?.value);
    const after = await updateSettingsGroup("fulfillment", parsed.data, admin.id);
    await logAudit({
      actor: admin,
      action: "settings.fulfillment",
      entityType: "SiteSetting",
      entityId: "fulfillment",
      summary: "Updated collection & delivery settings",
      changes: diffObjects(before, after) as object,
    });
    refresh();
    return ok("Collection & delivery settings saved");
  } catch (error) {
    return handleActionError(error);
  }
}

// ── Delivery areas ──────────────────────────────────────────────────────────

export async function saveDeliveryAreaAction(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const admin = await assertAdmin(AREA_ROLES.delivery);
    const parsed = deliveryAreaSchema.safeParse(deliveryAreaFormValues(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    const area = await saveDeliveryArea(id, parsed.data, admin);
    if (!id) createdId = area.id;
    refresh();
  } catch (error) {
    if (error instanceof DeliveryValidationError) return fail(error.message, error.fieldErrors);
    return handleActionError(error);
  }
  if (createdId) redirect("/admin/delivery?created=1");
  return ok("Locality saved");
}

export async function deleteDeliveryAreaAction(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.delivery);
    await deleteDeliveryArea(id, admin);
    refresh();
    return ok("Locality deleted");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function setDeliveryAreasEnabledAction(ids: string[], enabled: boolean): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.delivery);
    if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) return fail("Invalid selection.");
    const count = await setDeliveryAreasEnabled(ids, enabled, admin);
    refresh();
    return ok(enabled ? `Delivery switched on for ${count} locality(ies)` : `Delivery switched off for ${count} locality(ies)`);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function toggleDeliveryAreaPublished(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.delivery);
    const area = await db.deliveryArea.findUniqueOrThrow({ where: { id } });
    if (area.isPublished && area.hasPublicPage) {
      return fail("This locality has its own page. Switch the page off in the locality settings first.");
    }
    await db.deliveryArea.update({ where: { id }, data: { isPublished: !area.isPublished } });
    await logAudit({
      actor: admin,
      action: area.isPublished ? "deliveryArea.hide" : "deliveryArea.show",
      entityType: "DeliveryArea",
      entityId: id,
      summary: `${area.isPublished ? "Hid" : "Showed"} “${area.name}” on the website`,
    });
    refresh();
    return ok(area.isPublished ? `${area.name} hidden from the website` : `${area.name} shown on the website`);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function moveDeliveryArea(id: string, direction: "up" | "down"): Promise<ActionState> {
  try {
    await assertAdmin(AREA_ROLES.delivery);
    await moveItem("deliveryArea", id, direction);
    refresh();
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}

// ── Collection points ───────────────────────────────────────────────────────

export async function saveCollectionPoint(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const admin = await assertAdmin(AREA_ROLES.delivery);
    const parsed = collectionPointSchema.safeParse(collectionPointFormValues(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    if (id) {
      const before = await db.collectionPoint.findUniqueOrThrow({ where: { id } });
      const after = await db.collectionPoint.update({ where: { id }, data: parsed.data });
      const changes = diffObjects(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
      delete changes.updatedAt;
      await logAudit({
        actor: admin,
        action: "collectionPoint.update",
        entityType: "CollectionPoint",
        entityId: id,
        summary: `Updated collection point “${after.name}”`,
        changes: changes as object,
      });
    } else {
      const point = await db.collectionPoint.create({ data: { ...parsed.data, sortOrder: await nextSortOrder("collectionPoint") } });
      createdId = point.id;
      await logAudit({
        actor: admin,
        action: "collectionPoint.create",
        entityType: "CollectionPoint",
        entityId: point.id,
        summary: `Added collection point “${point.name}”`,
      });
    }
    refresh();
  } catch (error) {
    return handleActionError(error);
  }
  if (createdId) redirect("/admin/delivery?created=1#collection");
  return ok("Collection point saved");
}

export async function deleteCollectionPoint(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.delivery);
    const point = await db.collectionPoint.delete({ where: { id } });
    await logAudit({
      actor: admin,
      action: "collectionPoint.delete",
      entityType: "CollectionPoint",
      entityId: id,
      summary: `Deleted collection point “${point.name}” (past orders keep its name)`,
    });
    refresh();
    return ok("Collection point deleted");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function toggleCollectionPointActive(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.delivery);
    const point = await db.collectionPoint.findUniqueOrThrow({ where: { id } });
    await db.collectionPoint.update({ where: { id }, data: { isActive: !point.isActive } });
    await logAudit({
      actor: admin,
      action: point.isActive ? "collectionPoint.deactivate" : "collectionPoint.activate",
      entityType: "CollectionPoint",
      entityId: id,
      summary: `${point.isActive ? "Paused" : "Activated"} collection point “${point.name}”`,
    });
    refresh();
    return ok(point.isActive ? "Collection point paused" : "Collection point active");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function moveCollectionPoint(id: string, direction: "up" | "down"): Promise<ActionState> {
  try {
    await assertAdmin(AREA_ROLES.delivery);
    await moveItem("collectionPoint", id, direction);
    refresh();
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}
