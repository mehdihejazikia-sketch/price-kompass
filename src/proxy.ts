import { NextResponse, type NextRequest } from "next/server";

// Everything is private except the login page and the files a browser needs
// to install the app. The real session check happens on the server
// (requireUser / apiUser); this only sends visitors without a cookie to /login.
const PUBLIC = ["/login", "/api/auth/login", "/api/version", "/manifest.webmanifest", "/sw.js", "/offline.html"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p) || pathname.startsWith("/icons/")) return NextResponse.next();
  if (req.cookies.get("pk_session")?.value) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
