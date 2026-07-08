import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const FIREBASE_DEFAULT_HOSTS = new Set([
  "nausheen-customer.web.app",
  "nausheen-customer.firebaseapp.com"
]);

const CANONICAL_ORIGIN = "https://www.nausheenfruitjuicecenter.com";

function resolveHost(request: NextRequest): string {
  const raw =
    request.headers.get("x-fh-requested-host") ??
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";
  return raw.split(",")[0]?.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function middleware(request: NextRequest) {
  const host = resolveHost(request);
  if (!FIREBASE_DEFAULT_HOSTS.has(host)) {
    return NextResponse.next();
  }

  const destination = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_ORIGIN);
  return NextResponse.redirect(destination, 301);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|firebase-messaging-sw.js).*)"]
};
