import "dotenv/config";
import { afterAll, beforeEach, vi } from "vitest";

// Point the app's Prisma client at the disposable test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
process.env.STORAGE_DRIVER = "local";
process.env.UPLOAD_DIR = "./storage/test-uploads";
process.env.EMAIL_TRANSPORT = "disabled";
process.env.NEXT_PUBLIC_SITE_URL = "https://mcpreps.test";
process.env.HASH_SALT = "test-salt";
process.env.AUTH_SECRET ??= "test-auth-secret-for-integration-tests-only";

// Next.js request-scoped APIs are not available outside a request.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: async () => undefined, after: (fn: () => unknown) => void Promise.resolve().then(fn) };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
// Session is controlled per test via setTestSession().
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => globalThis.__testSession ?? null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

declare global {
  var __testSession: { user: { id: string; role: string; sv: number; email?: string; name?: string } } | null | undefined;
}

const { resetDatabase, disconnect } = await import("./helpers");

beforeEach(async () => {
  globalThis.__testSession = null;
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});
