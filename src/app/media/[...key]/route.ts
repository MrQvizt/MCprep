import { localStorageDriver } from "@/lib/storage";

const TYPES: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  avif: "image/avif",
};

/** Serves locally stored uploads (development / single-server hosting). */
export async function GET(_req: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key } = await ctx.params;
  const driver = localStorageDriver();
  if (!driver) return new Response("Not found", { status: 404 });
  const joined = key.join("/");
  let body: Buffer | null = null;
  try {
    body = await driver.read(joined);
  } catch {
    body = null;
  }
  if (!body) return new Response("Not found", { status: 404 });
  const ext = joined.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
