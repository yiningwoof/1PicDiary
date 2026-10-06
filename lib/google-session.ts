import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { refreshGoogleAccessToken } from "@/lib/google-auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { decryptGoogleToken, encryptGoogleToken } from "@/lib/token-crypto";

export const GOOGLE_SESSION_COOKIE = "google_session_id";
export const GOOGLE_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
const REFRESH_EARLY_MS = 60_000;

type GoogleSessionRow = {
  id: string;
  google_owner_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  access_token_expires_at: string;
  session_expires_at: string;
};

export class GoogleSessionError extends Error {}

const tokenContext = (sessionId: string, kind: "access" | "refresh") => `${sessionId}:${kind}`;

export async function createGoogleSession(input: { ownerId: string; accessToken: string; refreshToken: string; expiresIn: number }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new GoogleSessionError("Supabase is not configured for Google sessions");
  const id = randomUUID();
  const now = Date.now();
  const sessionExpiresAt = new Date(now + GOOGLE_SESSION_MAX_AGE_SECONDS * 1000);
  const { error } = await supabase.from("google_sessions").insert({
    id,
    google_owner_id: input.ownerId,
    access_token_ciphertext: encryptGoogleToken(input.accessToken, tokenContext(id, "access")),
    refresh_token_ciphertext: encryptGoogleToken(input.refreshToken, tokenContext(id, "refresh")),
    access_token_expires_at: new Date(now + input.expiresIn * 1000).toISOString(),
    session_expires_at: sessionExpiresAt.toISOString(),
  });
  if (error) throw new GoogleSessionError("Google session could not be saved");
  return { id, expires: sessionExpiresAt };
}

async function loadSession(sessionId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new GoogleSessionError("Google sessions are not configured");
  const { data, error } = await supabase.from("google_sessions")
    .select("id,google_owner_id,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,session_expires_at")
    .eq("id", sessionId).maybeSingle();
  if (error || !data) throw new GoogleSessionError("Google session was not found");
  return { supabase, row: data as GoogleSessionRow };
}

export async function getGoogleSession() {
  const sessionId = (await cookies()).get(GOOGLE_SESSION_COOKIE)?.value;
  if (!sessionId) throw new GoogleSessionError("Google Photos is not connected");
  const { supabase, row } = await loadSession(sessionId);
  if (new Date(row.session_expires_at).getTime() <= Date.now()) {
    await supabase.from("google_sessions").delete().eq("id", sessionId);
    throw new GoogleSessionError("Google session expired");
  }
  if (new Date(row.access_token_expires_at).getTime() > Date.now() + REFRESH_EARLY_MS) {
    return { accessToken: decryptGoogleToken(row.access_token_ciphertext, tokenContext(sessionId, "access")), ownerId: row.google_owner_id, supabase };
  }
  try {
    const refreshToken = decryptGoogleToken(row.refresh_token_ciphertext, tokenContext(sessionId, "refresh"));
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    const { error } = await supabase.from("google_sessions").update({
      access_token_ciphertext: encryptGoogleToken(refreshed.access_token, tokenContext(sessionId, "access")),
      access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      last_used_at: new Date().toISOString(),
    }).eq("id", sessionId);
    if (error) throw new Error("Session update failed");
    return { accessToken: refreshed.access_token, ownerId: row.google_owner_id, supabase };
  } catch {
    await supabase.from("google_sessions").delete().eq("id", sessionId);
    throw new GoogleSessionError("Google session could not be refreshed");
  }
}

export async function hasGoogleSession() {
  try { await getGoogleSession(); return true; } catch { return false; }
}

export async function deleteGoogleSession() {
  const sessionId = (await cookies()).get(GOOGLE_SESSION_COOKIE)?.value;
  const supabase = getSupabaseServerClient();
  if (sessionId && supabase) await supabase.from("google_sessions").delete().eq("id", sessionId);
}
