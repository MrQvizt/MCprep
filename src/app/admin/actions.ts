"use server";

import { redirect } from "next/navigation";
import { AuthError, CredentialsSignin } from "next-auth";
import { z } from "zod";
import { fail, type ActionState } from "@/lib/actions";
import { signIn, signOut } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("/admin/login") || next.includes("//")) return "/admin";
  return next;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return fail("Please check your details.", fieldErrors);
  }
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeNext(parsed.data.next),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error instanceof CredentialsSignin && error.code === "rate_limited") {
        return fail("Too many sign-in attempts. Please wait 15 minutes and try again.");
      }
      return fail("Incorrect email or password.");
    }
    throw error; // successful sign-in redirects
  }
  return { ok: true };
}

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/admin/login");
}
