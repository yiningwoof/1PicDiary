import { NextResponse } from "next/server";
import { deleteGoogleSession, GOOGLE_SESSION_COOKIE } from "@/lib/google-session";

export async function POST(request: Request) {
  await deleteGoogleSession();
  const response = NextResponse.redirect(new URL("/connect-google-photos", request.url), 303);
  response.cookies.delete(GOOGLE_SESSION_COOKIE);
  response.cookies.delete("google_access_token");
  return response;
}
