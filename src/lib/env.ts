import "server-only";
import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  VERCEL_PROJECT_PRODUCTION_URL: optionalString,
  VERCEL_BRANCH_URL: optionalString,
  VERCEL_URL: optionalString,
  VERCEL_ENV: optionalString,
  /** "true" forces indexing on, "false" forces it off (preview/staging). */
  ALLOW_INDEXING: optionalString,

  /** Where uploaded images go. Unset: the database on Vercel, local disk elsewhere. */
  STORAGE_DRIVER: z.enum(["local", "s3", "db"]).optional(),
  UPLOAD_DIR: z.string().default("./storage/uploads"),
  S3_BUCKET: optionalString,
  S3_REGION: optionalString,
  S3_ENDPOINT: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_FORCE_PATH_STYLE: optionalString,
  MEDIA_PUBLIC_BASE_URL: optionalString,

  EMAIL_TRANSPORT: z.enum(["resend", "console", "disabled"]).optional(),
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,

  CRON_SECRET: optionalString,
  TURNSTILE_SITE_KEY: optionalString,
  TURNSTILE_SECRET_KEY: optionalString,
  /** Secret used to hash rate-limit keys (IP addresses are never stored raw). */
  HASH_SALT: optionalString,
  AUTH_SECRET: optionalString,
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** The storage driver in use (explicit setting, else database on Vercel, local disk elsewhere). */
export function storageDriverName(): "local" | "s3" | "db" {
  const e = env();
  return e.STORAGE_DRIVER ?? (e.VERCEL_ENV ? "db" : "local");
}

/**
 * Public address of the site. NEXT_PUBLIC_SITE_URL wins; on Vercel the
 * production domain / preview URL is used when it isn't set.
 */
export function siteUrl(): string {
  const e = env();
  const fromVercel =
    e.VERCEL_ENV === "production"
      ? e.VERCEL_PROJECT_PRODUCTION_URL
      : (e.VERCEL_BRANCH_URL ?? e.VERCEL_URL);
  const url = e.NEXT_PUBLIC_SITE_URL ?? (fromVercel ? `https://${fromVercel}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Search engines may index this deployment only in production, unless
 * ALLOW_INDEXING explicitly overrides it. Preview deployments stay hidden.
 */
export function indexingAllowed(): boolean {
  const e = env();
  if (e.ALLOW_INDEXING === "true") return true;
  if (e.ALLOW_INDEXING === "false") return false;
  if (e.VERCEL_ENV) return e.VERCEL_ENV === "production";
  return e.NODE_ENV === "production";
}

export function emailTransport(): "resend" | "console" | "disabled" {
  const e = env();
  if (e.EMAIL_TRANSPORT) return e.EMAIL_TRANSPORT;
  if (e.RESEND_API_KEY) return "resend";
  return e.NODE_ENV === "production" ? "disabled" : "console";
}
