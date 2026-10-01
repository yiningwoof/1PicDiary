import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeCodeForToken } from "@/lib/google-auth";

function getPublicOrigin(requestUrl: URL) {
  const configuredRedirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (configuredRedirectUri) {
    try {
      return new URL(configuredRedirectUri).origin;
    } catch {
      // The token exchange will report the invalid OAuth configuration. Keep
      // redirects usable so the browser can still display the app's error UI.
    }
  }

  return requestUrl.origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const publicOrigin = getPublicOrigin(url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;

  if (url.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/connect-google-photos?auth=cancelled", publicOrigin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/connect-google-photos?auth=missing_code", publicOrigin));
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/connect-google-photos?auth=state_error", publicOrigin));
  }

  try {
    const token = await exchangeCodeForToken(code);
    const response = NextResponse.redirect(new URL("/connect-google-photos?auth=ok", publicOrigin));

    response.cookies.set("google_access_token", token.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: token.expires_in,
      path: "/",
    });

    response.cookies.delete("google_oauth_state");

    return response;
  } catch {
    return NextResponse.redirect(new URL("/connect-google-photos?auth=token_error", publicOrigin));
  }
}
