import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { findRedirect, recordRedirectHit } from "@/lib/redirects";

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

function indexingAllowed() {
  if (process.env.ALLOW_INDEXING === "true") return true;
  if (process.env.ALLOW_INDEXING === "false") return false;
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production";
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = request.nextUrl;

  // Admin: optimistic session check (authoritative checks run server-side on every page/action).
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!hasSession) {
      const url = new URL("/admin/login", request.url);
      if (pathname !== "/admin") url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Owner-managed redirects (301 by default).
  const hit = await findRedirect(pathname);
  if (hit) {
    event.waitUntil(recordRedirectHit(hit.id));
    const target = /^https?:\/\//i.test(hit.toPath) ? new URL(hit.toPath) : new URL(hit.toPath + search, request.url);
    return NextResponse.redirect(target, hit.statusCode);
  }

  const response = NextResponse.next();
  if (!indexingAllowed()) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|media|favicon.ico|icon|apple-icon|og|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml|js|css|map|woff2?)$).*)",
  ],
};
