import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { passwordProblem } from "@/lib/passwords";
import type { AdminRole } from "@/generated/prisma/client";

export class UserGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserGuardError";
  }
}

export const ROLES = ["OWNER", "ADMIN", "EDITOR"] as const;

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  OWNER: "Everything, including managing admin accounts.",
  ADMIN: "Orders, customers, prices, promotions, content and settings — but not admin accounts.",
  EDITOR: "Meals, photos, gallery, FAQs, blog and SEO only. Cannot see orders or customer details.",
};

export const newUserSchema = z
  .object({
    name: z.string().trim().min(2, "Enter their name.").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
    role: z.enum(ROLES),
    passwordMode: z.enum(["generate", "set"]),
    password: z.string(),
  })
  .superRefine((d, ctx) => {
    if (d.passwordMode === "set") {
      const problem = passwordProblem(d.password);
      if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    }
  });

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Enter their name.").max(80),
  role: z.enum(ROLES),
});

export const resetPasswordSchema = z.object({ mode: z.enum(["generate", "set"]), password: z.string() }).superRefine((d, ctx) => {
  if (d.mode === "set") {
    const problem = passwordProblem(d.password);
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
  }
});

/** Strong, readable temporary password (no look-alike characters). */
export function generateTemporaryPassword(length = 16): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%*-_";
  const all = letters + digits + symbols;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)], symbols[randomInt(symbols.length)]];
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export async function countActiveOwners(excludeId?: string): Promise<number> {
  return db.adminUser.count({ where: { role: "OWNER", isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

/**
 * Prevent locking everyone out: you can't demote or deactivate yourself, and
 * there must always be at least one active owner.
 */
export async function guardUserChange(
  actorId: string,
  target: { id: string; role: AdminRole; isActive: boolean },
  next: { role?: AdminRole; isActive?: boolean },
) {
  const nextRole = next.role ?? target.role;
  const nextActive = next.isActive ?? target.isActive;
  if (actorId === target.id) {
    if (!nextActive) throw new UserGuardError("You can't deactivate your own account.");
    if (nextRole !== target.role) throw new UserGuardError("You can't change your own role. Ask another owner.");
  }
  const losesOwner = target.role === "OWNER" && target.isActive && (nextRole !== "OWNER" || !nextActive);
  if (losesOwner && (await countActiveOwners(target.id)) === 0) {
    throw new UserGuardError("There must always be at least one active owner. Make someone else an owner first.");
  }
}
