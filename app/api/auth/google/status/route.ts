import { NextResponse } from "next/server";

import { getGoogleOwnerId } from "@/lib/google-auth";
import { deleteGoogleSession, getGoogleSession, GOOGLE_SESSION_COOKIE, GoogleSessionError } from "@/lib/google-session";

export const dynamic = "force-dynamic";

function identityStatus(error: unknown) {
  const match = error instanceof Error
    ? error.message.match(/^Google identity lookup failed: (\d+)$/)
    : null;
  return match ? Number(match[1]) : null;
}

export async function GET() {
  try {
    const session = await getGoogleSession();
    const ownerId = await getGoogleOwnerId(session.accessToken);
    if (ownerId !== session.ownerId) {
      throw new GoogleSessionError("The connected Google account changed");
    }
    return NextResponse.json(
      { connected: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = identityStatus(error);
    const reconnectRequired = error instanceof GoogleSessionError || status === 401 || status === 403;

    if (reconnectRequired) {
      await deleteGoogleSession();
      const response = NextResponse.json(
        { connected: false, reconnectRequired: true, error: "Reconnect Google Photos before creating a diary entry." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
      response.cookies.delete(GOOGLE_SESSION_COOKIE);
      return response;
    }

    return NextResponse.json(
      { connected: false, error: "Google Photos could not be checked right now. Please retry." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
