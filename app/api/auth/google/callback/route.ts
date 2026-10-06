import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeCodeForToken, getGoogleOwnerId } from "@/lib/google-auth";
import { createGoogleSession, deleteGoogleSession, GOOGLE_SESSION_COOKIE, GOOGLE_SESSION_MAX_AGE_SECONDS } from "@/lib/google-session";

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
    if (!token.refresh_token) throw new Error("Google did not return a refresh token");
    const ownerId = await getGoogleOwnerId(token.access_token);
    await deleteGoogleSession();
    const session = await createGoogleSession({
      ownerId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
    });
    const response = NextResponse.redirect(new URL("/connect-google-photos?auth=ok", publicOrigin));

    response.cookies.set(GOOGLE_SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: GOOGLE_SESSION_MAX_AGE_SECONDS,
      expires: session.expires,
      path: "/",
    });

    response.cookies.delete("google_access_token");
    response.cookies.delete("google_oauth_state");

    return response;
  } catch {
    return NextResponse.redirect(new URL("/connect-google-photos?auth=token_error", publicOrigin));
  }
}
