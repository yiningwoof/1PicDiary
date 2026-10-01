import { parseTextLayout, LayoutValidationError } from '@/lib/text-layout';
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { uploadPhotoToGooglePhotos } from "@/lib/google-photos";
import {
  composeDiaryImageWithLayout,
  isFontFamilyKey,
  resolveFontScale,
  resolveStrokeColor,
  resolveStrokeWidth,
  resolveTextColor,
  TextPosition,
} from "@/lib/image";
import { SubjectAccountError, getSubjectAccount } from "@/lib/subject-account";
import { sanitizeFileSegment } from "@/lib/security";
import { isDiaryDate } from "@/lib/diary-date";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("google_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Google OAuth required. Please connect Google first." },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const textLayout = parseTextLayout(formData.get("textLayout"));
    const file = formData.get("photo");
    const subjectId = String(formData.get("subjectId") ?? "").trim();
    const diaryDate = String(formData.get("diaryDate") ?? "").trim();
    const diaryText = String(formData.get("diaryText") ?? "").trim();
    const textPosition = String(formData.get("textPosition") ?? "bottom") as TextPosition;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "photo is required" }, { status: 400 });
    }

    if (!subjectId || !diaryText) {
      return NextResponse.json({ error: "missing required fields" }, { status: 400 });
    }

    if (!isDiaryDate(diaryDate)) {
      return NextResponse.json({ error: "Choose a valid diary date (YYYY-MM-DD)." }, { status: 400 });
    }

    if (!["top", "middle", "bottom"].includes(textPosition)) {
      return NextResponse.json({ error: "invalid textPosition" }, { status: 400 });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectId)) {
      return NextResponse.json({ error: "Select a saved subject first." }, { status: 400 });
    }
    const { ownerId, supabase: profileDb } = await getSubjectAccount();
    const { data: subject, error: subjectError } = await profileDb.from("subjects")
      .select("id,name,diary_album_title,google_diary_album_id,save_originals,google_originals_album_id")
      .eq("id", subjectId).eq("google_owner_id", ownerId).maybeSingle();
    if (subjectError) throw new SubjectAccountError("Your subject settings could not be loaded. Please try again.", 503);
    if (!subject) throw new SubjectAccountError("This subject is not available for the connected Google account. Reload your subjects.", 404);
    if (subject.save_originals && !subject.google_originals_album_id) {
      throw new SubjectAccountError("The originals album is missing from this subject’s settings. Finish album setup before saving.", 409);
    }
    const subjectName = subject.name;

    if (file.size > 30 * 1024 * 1024 || diaryText.length > 80 || subjectName.length > 80) {
      return NextResponse.json({ error: 'Choose a photo up to 30 MB and a diary line up to 80 characters.' }, { status: 400 });
    }
    const fontFamilyInput = formData.get("fontFamily");
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const safeSubjectName = sanitizeFileSegment(subjectName, "subject");
    const composed = await composeDiaryImageWithLayout({
      imageBuffer,
      subjectName,
      diaryText,
      textPosition,
      textLayout,
      fontFamily: isFontFamilyKey(fontFamilyInput) ? fontFamilyInput : undefined,
      fontScale: resolveFontScale(formData.get("fontScale")),
      textColor: resolveTextColor(formData.get("textColor")),
      strokeColor: resolveStrokeColor(formData.get("strokeColor")),
      strokeWidth: resolveStrokeWidth(formData.get("strokeWidth")),
    });

    const albumId = subject.google_diary_album_id;
    const mediaItemId = await uploadPhotoToGooglePhotos({
      accessToken,
      albumId,
      fileName: `${safeSubjectName}-${Date.now()}.png`,
      imageBuffer: composed.imageBuffer,
    });

    const warnings: string[] = [];
    let originalMediaItemId: string | null = null;
    if (subject.save_originals) {
      try {
        originalMediaItemId = await uploadPhotoToGooglePhotos({
          accessToken,
          albumId: subject.google_originals_album_id,
          fileName: file.name,
          imageBuffer,
          mimeType: file.type || "application/octet-stream",
        });
      } catch {
        warnings.push("The diary image was saved, but the original photo upload could not be confirmed. Check the originals album before retrying; do not re-upload the whole diary just to retry the original.");
      }
    }
    // The image lives only in Google Photos. Supabase keeps its reference and metadata.
    try {
      const insert = await profileDb.from("diaries").insert({
        subject_id: subject.id,
        diary_text: diaryText,
        diary_date: diaryDate,
        text_layout: composed.textLayout,
        google_media_item_id: mediaItemId,
        google_original_media_item_id: originalMediaItemId,
      });
      if (insert.error) {
        warnings.push("The image was saved to Google Photos, but the diary record could not be saved. Check the database setup; do not upload the photo again.");
      }
    } catch {
      warnings.push("The image was saved to Google Photos, but the diary record could not be confirmed. Check the database before retrying.");
    }

    return NextResponse.json({
      success: true,
      mediaItemId,
      originalMediaItemId,
      warnings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "save failed" },
      { status: error instanceof LayoutValidationError ? 400 : error instanceof SubjectAccountError ? error.status : 500 }
    );
  }
}
