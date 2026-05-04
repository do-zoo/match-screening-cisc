import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";

/** Only allow same-origin relative paths (open-redirect safe). */
function safeInternalPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("://")) return null;
  return raw;
}

/**
 * Admin routes that must stay reachable without a session (same policy as `/admin/sign-in`).
 * Without this, `/admin/sign-in/magic-link-sent` etc. are caught by the admin gate and
 * anonymous users get redirected — never seeing the confirmation page behind a proxy.
 */
const ANONYMOUS_ADMIN_AUTH_PATHS = new Set([
  "/admin/sign-in",
  "/admin/sign-in/magic-link-sent",
  "/admin/sign-in/two-factor",
]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  /** Onboarding dari undangan Owner — tidak perlu sesi Better Auth lebih dulu. */
  if (pathname.startsWith("/admin/invite/")) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  const isAnonymousAuthRoute = ANONYMOUS_ADMIN_AUTH_PATHS.has(pathname);

  // Sign-in flow pages: allow anonymous; redirect signed-in users away from sign-in root only.
  if (isAnonymousAuthRoute) {
    if (!session) return NextResponse.next();
    if (pathname === "/admin/sign-in") {
      const nextParam = safeInternalPath(req.nextUrl.searchParams.get("next"));
      const fallback = "/admin";
      const destination =
        nextParam && nextParam !== "/admin/sign-in" ? nextParam : fallback;
      return NextResponse.redirect(new URL(destination, req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/admin/sign-in", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

