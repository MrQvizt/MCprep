import { ZodError } from "zod";

/** Standard return shape for server actions used with useActionState. */
export interface ActionState<T = unknown> {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
  /** Changes on every submission so clients can react to repeated results. */
  ts?: number;
}

export const initialActionState: ActionState = { ok: false };

export function ok<T>(message?: string, data?: T): ActionState<T> {
  return { ok: true, message, data, ts: Date.now() };
}

export function fail(message: string, fieldErrors?: Record<string, string>): ActionState<never> {
  return { ok: false, message, fieldErrors, ts: Date.now() };
}

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function fromZodError(error: ZodError, message = "Please check the highlighted fields."): ActionState<never> {
  return fail(message, zodFieldErrors(error));
}

/** Convert unknown errors in admin actions into friendly messages. */
export function handleActionError(error: unknown): ActionState<never> {
  if (error instanceof ZodError) return fromZodError(error);
  if (error && typeof error === "object") {
    const e = error as { name?: string; code?: string; message?: string; meta?: { target?: unknown } };
    if (e.name === "AuthorizationError") return fail(e.message ?? "Not allowed.");
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? (e.meta?.target as string[]).join(", ") : "value";
      return fail(`That ${target} is already in use. Please choose another.`);
    }
    if (e.code === "P2025") return fail("This item no longer exists. Refresh the page and try again.");
    if (e.code === "P2003") return fail("This item is still in use elsewhere and can't be removed.");
    if (e.name === "ImageValidationError") return fail(e.message ?? "Invalid image.");
    // Next.js redirect/notFound errors must propagate.
    if (typeof e.message === "string" && (e.message === "NEXT_REDIRECT" || e.message.startsWith("NEXT_"))) throw error;
    const digest = (error as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;
  }
  console.error("[action] unexpected error", error);
  return fail("Something went wrong. Please try again.");
}

// ── FormData helpers ────────────────────────────────────────────────────────

export function fdString(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function fdOptional(fd: FormData, name: string): string | null {
  const v = fdString(fd, name);
  return v === "" ? null : v;
}

export function fdBool(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "true" || v === "1";
}

export function fdInt(fd: FormData, name: string): number | null {
  const v = fdString(fd, name);
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

export function fdList(fd: FormData, name: string): string[] {
  return fd
    .getAll(name)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Newline/comma separated textarea → trimmed list. */
export function fdLines(fd: FormData, name: string): string[] {
  return fdString(fd, name)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
