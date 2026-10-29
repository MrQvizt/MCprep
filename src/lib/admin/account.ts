import "server-only";
import { z } from "zod";
import { logAudit, type AuditActor } from "@/lib/audit";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/passwords";
import { rateLimit } from "@/lib/rate-limit";

export class AccountError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "AccountError";
  }
}

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  currentPassword: z.string().max(200),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(200),
    newPassword: z.string().max(200),
    confirmPassword: z.string().max(200),
  })
  .superRefine((d, ctx) => {
    const problem = passwordProblem(d.newPassword);
    if (problem) ctx.addIssue({ code: "custom", path: ["newPassword"], message: problem });
    if (d.newPassword !== d.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "The two new passwords don't match." });
    if (d.newPassword && d.newPassword === d.currentPassword) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Choose a password you haven't used here before." });
    }
  });

async function checkCurrentPassword(userId: string, password: string) {
  const limited = await rateLimit(`account-password:${userId}`, 10, 15 * 60);
  if (!limited.ok) throw new AccountError("Too many attempts. Please wait 15 minutes and try again.");
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AccountError("Your current password is incorrect.", { currentPassword: "Your current password is incorrect." });
  }
  return user;
}

/** Update your own name (and email — which requires your current password). */
export async function updateOwnProfile(actor: AuditActor, input: z.infer<typeof profileSchema>) {
  const user = await db.adminUser.findUniqueOrThrow({ where: { id: actor.id } });
  const emailChanged = input.email !== user.email;
  if (emailChanged) {
    if (!input.currentPassword) {
      throw new AccountError("Enter your current password to change your email.", {
        currentPassword: "Required to change your email address.",
      });
    }
    await checkCurrentPassword(actor.id, input.currentPassword);
  }
  await db.adminUser.update({ where: { id: actor.id }, data: { name: input.name, email: input.email } });
  await logAudit({
    actor,
    action: emailChanged ? "account.email" : "account.update",
    entityType: "AdminUser",
    entityId: actor.id,
    summary: emailChanged ? `Changed sign-in email from ${user.email} to ${input.email}` : "Updated own profile",
  });
  return { emailChanged };
}

/** Change your own password. Signs out every session (sessionVersion bump). */
export async function changeOwnPassword(actor: AuditActor, input: z.infer<typeof passwordChangeSchema>) {
  await checkCurrentPassword(actor.id, input.currentPassword);
  await db.adminUser.update({
    where: { id: actor.id },
    data: { passwordHash: await hashPassword(input.newPassword), sessionVersion: { increment: 1 } },
  });
  await logAudit({
    actor,
    action: "account.password",
    entityType: "AdminUser",
    entityId: actor.id,
    summary: "Changed own password (all sessions signed out)",
  });
}
