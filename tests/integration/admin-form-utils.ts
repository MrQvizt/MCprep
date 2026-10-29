/** Build FormData like the admin forms post it (checkboxes → "on", lists → repeated keys). */
export function form(fields: Record<string, string | string[] | boolean | number | null | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === false) continue;
    if (value === true) fd.set(key, "on");
    else if (Array.isArray(value)) for (const v of value) fd.append(key, v);
    else fd.set(key, String(value));
  }
  return fd;
}

export const initial = { ok: false } as const;

/** Run a server action that may redirect; returns the redirect URL (or null) and the result. */
export async function runAction<T>(fn: () => Promise<T>): Promise<{ result: T | null; redirectTo: string | null }> {
  try {
    return { result: await fn(), redirectTo: null };
  } catch (error) {
    const digest = (error as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return { result: null, redirectTo: digest.split(";")[2] ?? null };
    }
    throw error;
  }
}
