import "server-only";
import { z } from "zod";
import { fdBool, fdList, fdString } from "@/lib/actions";
import { diffObjects, logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseMoneyToCents } from "@/lib/money";
import { createSlugChangeRedirect } from "@/lib/redirects";
import { nextSortOrder } from "@/lib/admin/reorder";
import { SLUG_RE, slugify } from "@/lib/urls";

/** A locality page must have at least this many words of genuinely local information. */
export const MIN_LOCALITY_PAGE_WORDS = 150;
/** Two locality pages sharing more than this proportion of phrases count as duplicates. */
export const MAX_LOCALITY_PAGE_SIMILARITY = 0.6;

export function countWords(text: string | null | undefined): number {
  const t = (text ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

function shingles(text: string, size = 3): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(" "));
  return out;
}

/** Jaccard similarity of 3-word phrases (0 = nothing shared, 1 = identical). */
export function textSimilarity(a: string, b: string): number {
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const s of sa) if (sb.has(s)) shared++;
  return shared / (sa.size + sb.size - shared);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const moneyField = (label: string) =>
  z.string().transform((value, ctx) => {
    if (value.trim() === "") return null;
    const cents = parseMoneyToCents(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: `Enter the ${label} in euro, e.g. 3.50 — or leave it blank.` });
      return z.NEVER;
    }
    return cents;
  });

const weekdays = z
  .array(z.coerce.number().int().min(0).max(6))
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

export const deliveryAreaSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the locality name.").max(80),
    slug: z
      .string()
      .trim()
      .max(80)
      .regex(SLUG_RE, "Use lower-case letters, numbers and hyphens only (e.g. st-julians)."),
    region: z.enum(["MALTA", "GOZO", "COMINO"]),
    deliveryAvailable: z.boolean(),
    isPublished: z.boolean(),
    deliveryFeeCents: moneyField("delivery fee"),
    minOrderCents: moneyField("minimum order"),
    deliveryDays: weekdays,
    deliveryWindow: optionalText(120),
    notes: optionalText(600),
    zone: optionalText(60),
    hasPublicPage: z.boolean(),
    pageIntro: optionalText(600),
    pageBody: optionalText(12000),
  })
  .superRefine((d, ctx) => {
    if (!d.hasPublicPage) return;
    if (!d.deliveryAvailable || !d.isPublished) {
      ctx.addIssue({
        code: "custom",
        path: ["hasPublicPage"],
        message: "A locality page can only be switched on for a published locality you actually deliver to.",
      });
    }
    if (!d.pageIntro || d.pageIntro.length < 40) {
      ctx.addIssue({ code: "custom", path: ["pageIntro"], message: "Write a short introduction for this locality (at least 40 characters)." });
    }
    const words = countWords(d.pageBody);
    if (words < MIN_LOCALITY_PAGE_WORDS) {
      ctx.addIssue({
        code: "custom",
        path: ["pageBody"],
        message: `Write at least ${MIN_LOCALITY_PAGE_WORDS} words of information specific to ${d.name || "this locality"} (currently ${words}).`,
      });
    }
  });

export type DeliveryAreaInput = z.infer<typeof deliveryAreaSchema>;

export function deliveryAreaFormValues(fd: FormData) {
  const name = fdString(fd, "name");
  return {
    name,
    slug: fdString(fd, "slug") || slugify(name),
    region: fdString(fd, "region") || "MALTA",
    deliveryAvailable: fdBool(fd, "deliveryAvailable"),
    isPublished: fdBool(fd, "isPublished"),
    deliveryFeeCents: fdString(fd, "deliveryFee"),
    minOrderCents: fdString(fd, "minOrder"),
    deliveryDays: fdList(fd, "deliveryDays"),
    deliveryWindow: fdString(fd, "deliveryWindow"),
    notes: fdString(fd, "notes"),
    zone: fdString(fd, "zone"),
    hasPublicPage: fdBool(fd, "hasPublicPage"),
    pageIntro: fdString(fd, "pageIntro"),
    pageBody: fdString(fd, "pageBody"),
  };
}

export class DeliveryValidationError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string>,
  ) {
    super(message);
    this.name = "DeliveryValidationError";
  }
}

const localityPath = (slug: string) => `/delivery-areas/${slug}`;

/**
 * Create or update a delivery area. Handles duplicate-content checks for
 * locality pages and redirects when a public page moves or disappears.
 */
export async function saveDeliveryArea(id: string | null, data: DeliveryAreaInput, actor: AuditActor) {
  if (data.hasPublicPage && data.pageBody) {
    const others = await db.deliveryArea.findMany({
      where: { hasPublicPage: true, pageBody: { not: null }, ...(id ? { id: { not: id } } : {}) },
      select: { name: true, pageBody: true },
    });
    for (const other of others) {
      if (other.pageBody && textSimilarity(data.pageBody, other.pageBody) > MAX_LOCALITY_PAGE_SIMILARITY) {
        throw new DeliveryValidationError("This page is too similar to another locality page.", {
          pageBody: `This text is too similar to the ${other.name} page. Each locality page needs its own, genuinely local information — otherwise Google may treat them as duplicate "doorway" pages.`,
        });
      }
    }
  }

  if (!id) {
    const area = await db.deliveryArea.create({ data: { ...data, sortOrder: await nextSortOrder("deliveryArea") } });
    await logAudit({
      actor,
      action: "deliveryArea.create",
      entityType: "DeliveryArea",
      entityId: area.id,
      summary: `Added delivery locality “${area.name}”${area.deliveryAvailable ? " (delivery on)" : ""}`,
    });
    return area;
  }

  const before = await db.deliveryArea.findUniqueOrThrow({ where: { id } });
  const area = await db.deliveryArea.update({ where: { id }, data });

  // Keep old links working when a public locality page moves or is removed.
  if (before.hasPublicPage && before.slug !== area.slug && area.hasPublicPage) {
    await createSlugChangeRedirect(localityPath(before.slug), localityPath(area.slug), `Locality “${area.name}” address changed`);
  } else if (before.hasPublicPage && !area.hasPublicPage) {
    await createSlugChangeRedirect(localityPath(before.slug), "/delivery-areas", `Locality page “${area.name}” switched off`);
  }

  const changes = diffObjects(before as unknown as Record<string, unknown>, area as unknown as Record<string, unknown>);
  delete changes.updatedAt;
  await logAudit({
    actor,
    action: "deliveryArea.update",
    entityType: "DeliveryArea",
    entityId: id,
    summary: `Updated delivery locality “${area.name}”`,
    changes: changes as object,
  });
  return area;
}

export async function deleteDeliveryArea(id: string, actor: AuditActor) {
  const area = await db.deliveryArea.delete({ where: { id } });
  if (area.hasPublicPage) {
    await createSlugChangeRedirect(localityPath(area.slug), "/delivery-areas", `Locality “${area.name}” deleted`);
  }
  await logAudit({
    actor,
    action: "deliveryArea.delete",
    entityType: "DeliveryArea",
    entityId: id,
    summary: `Deleted delivery locality “${area.name}” (past orders keep the locality name)`,
  });
  return area;
}

/** Switch delivery on/off for several localities at once. */
export async function setDeliveryAreasEnabled(ids: string[], enabled: boolean, actor: AuditActor) {
  const unique = [...new Set(ids)].slice(0, 200);
  if (unique.length === 0) return 0;
  const areas = await db.deliveryArea.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, slug: true, hasPublicPage: true } });
  await db.deliveryArea.updateMany({
    where: { id: { in: areas.map((a) => a.id) } },
    data: enabled
      ? { deliveryAvailable: true, isPublished: true }
      : { deliveryAvailable: false, isPublished: false, hasPublicPage: false },
  });
  if (!enabled) {
    for (const a of areas.filter((x) => x.hasPublicPage)) {
      await createSlugChangeRedirect(localityPath(a.slug), "/delivery-areas", `Locality “${a.name}” switched off`);
    }
  }
  await logAudit({
    actor,
    action: enabled ? "deliveryArea.enable" : "deliveryArea.disable",
    entityType: "DeliveryArea",
    summary: `${enabled ? "Switched on" : "Switched off"} delivery for ${areas.map((a) => a.name).join(", ")}`,
    changes: { ids: areas.map((a) => a.id) },
  });
  return areas.length;
}

// ── Collection points ───────────────────────────────────────────────────────

export const collectionPointSchema = z.object({
  name: z.string().trim().min(2, "Enter a name for this collection point.").max(80),
  address: optionalText(400),
  showAddressPublicly: z.boolean(),
  instructions: optionalText(800),
  availableDays: weekdays,
  timeWindows: optionalText(300),
  isActive: z.boolean(),
}).superRefine((d, ctx) => {
  if (d.showAddressPublicly && !d.address) {
    ctx.addIssue({ code: "custom", path: ["address"], message: "Add the address, or untick “Show address publicly”." });
  }
});

export type CollectionPointInput = z.infer<typeof collectionPointSchema>;

export function collectionPointFormValues(fd: FormData) {
  return {
    name: fdString(fd, "name"),
    address: fdString(fd, "address"),
    showAddressPublicly: fdBool(fd, "showAddressPublicly"),
    instructions: fdString(fd, "instructions"),
    availableDays: fdList(fd, "availableDays"),
    timeWindows: fdString(fd, "timeWindows"),
    isActive: fdBool(fd, "isActive"),
  };
}

// ── Fulfilment settings ─────────────────────────────────────────────────────

export const fulfillmentFormSchema = z
  .object({
    deliveryEnabled: z.boolean(),
    collectionEnabled: z.boolean(),
    deliveryInfo: z.string().trim().max(1500),
    collectionInfo: z.string().trim().max(1500),
    noDeliveryAreasMessage: z.string().trim().min(10, "Write a short message for customers.").max(600),
    leadTimeDays: z.coerce
      .number({ message: "Enter a number of days." })
      .int("Use whole days.")
      .min(0, "Can't be negative.")
      .max(60, "Use 60 days or fewer."),
    gozoNote: z.string().trim().max(600),
    weeklyCutoffEnabled: z.boolean(),
    weeklyCutoffDay: z.coerce.number().int().min(0, "Choose a day.").max(6, "Choose a day."),
    weeklyCutoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 16:00."),
  })
  .superRefine((d, ctx) => {
    if (!d.deliveryEnabled && !d.collectionEnabled) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryEnabled"],
        message: "Keep collection or delivery switched on — otherwise customers can't place an order.",
      });
    }
  });

export function fulfillmentFormValues(fd: FormData) {
  return {
    deliveryEnabled: fdBool(fd, "deliveryEnabled"),
    collectionEnabled: fdBool(fd, "collectionEnabled"),
    deliveryInfo: fdString(fd, "deliveryInfo"),
    collectionInfo: fdString(fd, "collectionInfo"),
    noDeliveryAreasMessage: fdString(fd, "noDeliveryAreasMessage"),
    leadTimeDays: fdString(fd, "leadTimeDays") || "0",
    gozoNote: fdString(fd, "gozoNote"),
    weeklyCutoffEnabled: fdBool(fd, "weeklyCutoffEnabled"),
    weeklyCutoffDay: fdString(fd, "weeklyCutoffDay") || "3",
    weeklyCutoffTime: fdString(fd, "weeklyCutoffTime") || "16:00",
  };
}
