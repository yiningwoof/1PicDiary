import { NextResponse } from "next/server";
import { subjectAccountError, SubjectAccountError, getSubjectAccount } from "@/lib/subject-account";
import { albumNames } from "@/lib/album-names";
import { getOrCreateAlbum } from "@/lib/google-photos";

export async function GET() {
  try {
    const { ownerId, supabase } = await getSubjectAccount();
    const { data, error } = await supabase.from("subjects")
      .select("id,name,diary_album_title,save_originals,originals_album_title").eq("google_owner_id", ownerId)
      .order("created_at");
    if (error) throw new SubjectAccountError("Your subject profiles could not be loaded. Check that the subjects database schema has been applied, then retry.", 503);
    return NextResponse.json({ subjects: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return subjectAccountError(error); }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      throw new SubjectAccountError("Please add subjects from 1PicDiary.", 403);
    }
    const { accessToken, ownerId, supabase } = await getSubjectAccount();
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const albums = albumNames(typeof body?.albumTitle === "string" ? body.albumTitle : "");
    const albumTitle = albums.diary;
    const saveOriginals = body?.saveOriginals ?? true;
    if (typeof saveOriginals !== "boolean") throw new SubjectAccountError("Choose whether to keep original photos.", 400);
    if (!name || name.length > 80 || !albums.base || albums.base.length > 186) {
      throw new SubjectAccountError("Enter a subject name (up to 80 characters) and album prefix (up to 186 characters).", 400);
    }
    // Check before contacting Photos; database constraints also protect concurrent requests.
    const { data: existing, error: lookupError } = await supabase.from("subjects")
      .select("name,diary_album_title,originals_album_title").eq("google_owner_id", ownerId);
    if (lookupError) throw new SubjectAccountError("Subject profiles are unavailable. Check the database setup and retry.", 503);
    if (existing?.some((subject) => subject.name.toLowerCase() === name.toLowerCase() || [subject.diary_album_title, subject.originals_album_title].some((title) => title && [albumTitle, ...(saveOriginals ? [albums.originals] : [])].some((candidate) => candidate.toLowerCase() === title.toLowerCase())))) {
      throw new SubjectAccountError("That subject or album name is already in use. Select the existing subject or choose a different name.", 409);
    }
    let albumId: string;
    let originalAlbumId: string | null = null;
    try {
      albumId = await getOrCreateAlbum(accessToken, albumTitle);
      if (saveOriginals) originalAlbumId = await getOrCreateAlbum(accessToken, albums.originals);
    } catch {
      throw new SubjectAccountError("Google Photos could not finish setting up the albums. Reconnect and allow both Photos permissions, then retry with the same prefix to reuse any album already created.", 502);
    }
    const { data, error } = await supabase.from("subjects").insert({
      google_owner_id: ownerId, name, diary_album_title: albumTitle, google_diary_album_id: albumId,
      save_originals: saveOriginals,
      originals_album_title: saveOriginals ? albums.originals : null,
      google_originals_album_id: originalAlbumId,
    }).select("id,name,diary_album_title,save_originals,originals_album_title").single();
    if (error) {
      throw new SubjectAccountError(error.code === "23505"
        ? "That subject or album is already in use. Refresh your subjects and try again."
        : "The album is ready, but the subject settings could not be saved. Try again with the same album name.", error.code === "23505" ? 409 : 503);
    }
    return NextResponse.json({ subject: data }, { status: 201 });
  } catch (error) { return subjectAccountError(error); }
}
