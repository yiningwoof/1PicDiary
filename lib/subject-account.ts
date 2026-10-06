import { NextResponse } from "next/server";
import { getGoogleSession, GoogleSessionError } from "@/lib/google-session";

export class SubjectAccountError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function getSubjectAccount() {
  try {
    return await getGoogleSession();
  } catch (error) {
    if (error instanceof GoogleSessionError) {
      throw new SubjectAccountError("Connect Google Photos to load your subjects and albums.", 401);
    }
    throw error;
  }
}

export function subjectAccountError(error: unknown) {
  return NextResponse.json(
    { error: error instanceof SubjectAccountError ? error.message : "Unable to load or save your subject settings. Please try again." },
    { status: error instanceof SubjectAccountError ? error.status : 500 },
  );
}
