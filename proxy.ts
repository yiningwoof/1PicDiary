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

// Large photo requests bypass the canonical-host proxy so Next.js does not
// buffer their request bodies. They are sent from an already-canonical page.
export const config = { matcher: ["/((?!api/editor-photo|api/save-diary|api/compose|_next/static|_next/image|favicon.ico).*)"] };
