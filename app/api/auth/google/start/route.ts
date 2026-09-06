import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { buildGoogleOAuthUrl } from "@/lib/google-auth";

export function GET() {
  try {
    const state = randomUUID();
    const response = NextResponse.redirect(buildGoogleOAuthUrl(state));
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "OAuth start failed" },
      { status: 500 }
    );
  }
}
