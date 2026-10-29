import "server-only";
import { z } from "zod";
import { fdBool, fdString } from "@/lib/actions";
import { nextSortOrder } from "@/lib/admin/reorder";
import { logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { zonedLocalToUtc } from "@/lib/time";
import { mediaIdField, optionalText, requiredText } from "./fields";

export const testimonialSchema = z
  .object({
    quote: requiredText("Quote", 800, 5),
    displayName: requiredText("Display name", 60),
    context: optionalText("Context", 80),
    photoId: mediaIdField,
    source: optionalText("Source", 80),
    consentDate: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === "") return null;
        const d = zonedLocalToUtc(`${v}T12:00`);
        if (!d) {
          ctx.addIssue({ code: "custom", message: "Choose a valid date." });
          return z.NEVER;
        }
        return d;
      }),
    consentNotes: optionalText("Permission notes", 500),
    isPublished: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.isPublished && !v.consentDate) {
      ctx.addIssue({
        code: "custom",
        path: ["consentDate"],
        message: "Record when the customer gave permission before publishing this testimonial.",
      });
    }
  });

export type TestimonialInput = z.infer<typeof testimonialSchema>;

export function parseTestimonialForm(fd: FormData) {
  return testimonialSchema.parse({
    quote: fdString(fd, "quote"),
    displayName: fdString(fd, "displayName"),
    context: fdString(fd, "context"),
    photoId: fdString(fd, "photoId"),
    source: fdString(fd, "source"),
    consentDate: fdString(fd, "consentDate"),
    consentNotes: fdString(fd, "consentNotes"),
    isPublished: fdBool(fd, "isPublished"),
  });
}

function toData(input: TestimonialInput) {
  const { consentDate, ...rest } = input;
  return { ...rest, consentRecordedAt: consentDate };
}

export async function createTestimonial(actor: AuditActor, input: TestimonialInput) {
  const t = await db.testimonial.create({ data: { ...toData(input), sortOrder: await nextSortOrder("testimonial") } });
  await logAudit({ actor, action: "testimonial.create", entityType: "Testimonial", entityId: t.id, summary: `Added testimonial from ${t.displayName}` });
  return t;
}

export async function updateTestimonial(actor: AuditActor, id: string, input: TestimonialInput) {
  const t = await db.testimonial.update({ where: { id }, data: toData(input) });
  await logAudit({ actor, action: "testimonial.update", entityType: "Testimonial", entityId: id, summary: `Updated testimonial from ${t.displayName}` });
  return t;
}

export class ConsentRequiredError extends Error {}

export async function toggleTestimonialPublished(actor: AuditActor, id: string) {
  const t = await db.testimonial.findUniqueOrThrow({ where: { id } });
  const isPublished = !t.isPublished;
  if (isPublished && !t.consentRecordedAt) {
    throw new ConsentRequiredError("Record the customer's permission (date) before publishing this testimonial.");
  }
  await db.testimonial.update({ where: { id }, data: { isPublished } });
  await logAudit({
    actor,
    action: isPublished ? "testimonial.publish" : "testimonial.unpublish",
    entityType: "Testimonial",
    entityId: id,
    summary: `${isPublished ? "Published" : "Hid"} testimonial from ${t.displayName}`,
  });
  return isPublished;
}

export async function deleteTestimonial(actor: AuditActor, id: string) {
  const t = await db.testimonial.delete({ where: { id } });
  await logAudit({ actor, action: "testimonial.delete", entityType: "Testimonial", entityId: id, summary: `Deleted testimonial from ${t.displayName}` });
}
