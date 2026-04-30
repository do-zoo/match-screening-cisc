import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";

/** Only allow same-origin relative paths (open-redirect safe). */
function safeInternalPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("://")) return null;
  return raw;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  // Sign-in page: skip auth redirect when anonymous; bounce authenticated users away.
  if (pathname === "/admin/sign-in") {
    if (!session) return NextResponse.next();
    const nextParam = safeInternalPath(req.nextUrl.searchParams.get("next"));
    const fallback = "/admin";
    const destination =
      nextParam && nextParam !== "/admin/sign-in" ? nextParam : fallback;
    return NextResponse.redirect(new URL(destination, req.url));
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

