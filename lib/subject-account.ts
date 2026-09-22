import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export class SubjectAccountError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function getSubjectAccount() {
  const accessToken = (await cookies()).get("google_access_token")?.value;
  if (!accessToken) {
    throw new SubjectAccountError("Connect Google Photos to load your subjects and albums.", 401);
  }
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new SubjectAccountError("Subject profiles are not configured yet. The app owner needs to configure Supabase and apply the database schema.", 503);
  }
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new SubjectAccountError("Google sign-in could not be verified. Please reconnect Google Photos.", 401);
  }
  const identity = await response.json();
  if (typeof identity.sub !== "string" || !identity.sub) {
    throw new SubjectAccountError("Google sign-in could not be verified. Please reconnect Google Photos.", 401);
  }
  return { accessToken, ownerId: identity.sub, supabase };
}

export function subjectAccountError(error: unknown) {
  return NextResponse.json(
    { error: error instanceof SubjectAccountError ? error.message : "Unable to load or save your subject settings. Please try again." },
    { status: error instanceof SubjectAccountError ? error.status : 500 },
  );
}
