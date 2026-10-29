"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fdBool, fdString, handleActionError, ok, type ActionState } from "@/lib/actions";
import { moveItem, nextSortOrder } from "@/lib/admin/reorder";
import { logAudit } from "@/lib/audit";
import { AREA_ROLES, assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { revalidatePublicSite } from "@/lib/revalidate";

const faqSchema = z.object({
  question: z.string().trim().min(5, "Write the question (at least 5 characters).").max(240),
  answer: z.string().trim().min(5, "Write the answer.").max(2000),
  category: z.string().trim().max(60).optional().transform((v) => v || null),
  isPublished: z.boolean(),
  showOnHomepage: z.boolean(),
});

function refresh() {
  revalidatePath("/admin/faqs");
  revalidatePublicSite();
}

export async function saveFaq(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const admin = await assertAdmin(AREA_ROLES.faqs);
    const data = faqSchema.parse({
      question: fdString(fd, "question"),
      answer: fdString(fd, "answer"),
      category: fdString(fd, "category"),
      isPublished: fdBool(fd, "isPublished"),
      showOnHomepage: fdBool(fd, "showOnHomepage"),
    });
    if (id) {
      await db.fAQ.update({ where: { id }, data: { ...data, isDemo: false } });
      await logAudit({ actor: admin, action: "faq.update", entityType: "FAQ", entityId: id, summary: `Updated FAQ “${data.question}”` });
    } else {
      const faq = await db.fAQ.create({ data: { ...data, sortOrder: await nextSortOrder("faq") } });
      createdId = faq.id;
      await logAudit({ actor: admin, action: "faq.create", entityType: "FAQ", entityId: faq.id, summary: `Created FAQ “${data.question}”` });
    }
    refresh();
  } catch (error) {
    return handleActionError(error);
  }
  if (createdId) redirect("/admin/faqs?created=1");
  return ok("FAQ saved");
}

export async function deleteFaq(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.faqs);
    const faq = await db.fAQ.delete({ where: { id } });
    await logAudit({ actor: admin, action: "faq.delete", entityType: "FAQ", entityId: id, summary: `Deleted FAQ “${faq.question}”` });
    refresh();
    return ok("FAQ deleted");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function moveFaq(id: string, direction: "up" | "down"): Promise<ActionState> {
  try {
    await assertAdmin(AREA_ROLES.faqs);
    await moveItem("faq", id, direction);
    refresh();
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function toggleFaqPublished(id: string): Promise<ActionState> {
  try {
    const admin = await assertAdmin(AREA_ROLES.faqs);
    const faq = await db.fAQ.findUniqueOrThrow({ where: { id } });
    await db.fAQ.update({ where: { id }, data: { isPublished: !faq.isPublished } });
    await logAudit({
      actor: admin,
      action: faq.isPublished ? "faq.unpublish" : "faq.publish",
      entityType: "FAQ",
      entityId: id,
      summary: `${faq.isPublished ? "Unpublished" : "Published"} FAQ “${faq.question}”`,
    });
    refresh();
    return ok(faq.isPublished ? "FAQ hidden from the website" : "FAQ published");
  } catch (error) {
    return handleActionError(error);
  }
}
