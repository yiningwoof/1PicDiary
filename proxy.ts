import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const configuredUrl = process.env.APP_URL;
  if (!configuredUrl) return NextResponse.next();
  let canonical: URL;
  try { canonical = new URL(configuredUrl); } catch { return NextResponse.next(); }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const incomingHost = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  if (incomingHost === canonical.host) return NextResponse.next();
  return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, canonical), 308);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
