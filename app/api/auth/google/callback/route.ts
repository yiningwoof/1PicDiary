import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeCodeForToken } from "@/lib/google-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;

  if (url.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/connect-google-photos?auth=cancelled", url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/connect-google-photos?auth=missing_code", url.origin));
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/connect-google-photos?auth=state_error", url.origin));
  }

  try {
    const token = await exchangeCodeForToken(code);
    const response = NextResponse.redirect(new URL("/connect-google-photos?auth=ok", url.origin));

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
    return NextResponse.redirect(new URL("/connect-google-photos?auth=token_error", url.origin));
  }
}
