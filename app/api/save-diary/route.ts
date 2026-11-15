import { parseTextLayout, LayoutValidationError } from '@/lib/text-layout';
import { NextResponse } from "next/server";

import { fitGooglePhotosDescription, GooglePhotosError, uploadPhotoToGooglePhotos } from "@/lib/google-photos";
import { addDiaryDateMetadata } from "@/lib/google-photo-metadata";
import {
  composeDiaryImageWithLayout,
  PhotoInputError,
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
import { exceedsGooglePhotosPhotoLimit, googlePhotosPhotoLimitMessage } from "@/lib/upload-limits";
import { UUID_PATTERN } from "@/lib/diary-ideas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { accessToken, ownerId, supabase: profileDb } = await getSubjectAccount();

    const formData = await request.formData();

    const textLayout = parseTextLayout(formData.get("textLayout"));
    const file = formData.get("photo");
    const subjectId = String(formData.get("subjectId") ?? "").trim();
    const diaryDate = String(formData.get("diaryDate") ?? "").trim();
    const diaryText = String(formData.get("diaryText") ?? "").trim();
    const ideaId = String(formData.get("ideaId") ?? "").trim();
    const textPosition = String(formData.get("textPosition") ?? "bottom") as TextPosition;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "photo is required" }, { status: 400 });
    }
    if (exceedsGooglePhotosPhotoLimit(file.size)) {
      return NextResponse.json({ error: googlePhotosPhotoLimitMessage }, { status: 413 });
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
    const { data: subject, error: subjectError } = await profileDb.from("subjects")
      .select("id,name,diary_album_title,google_diary_album_id,save_originals,google_originals_album_id")
      .eq("id", subjectId).eq("google_owner_id", ownerId).maybeSingle();
    if (subjectError) throw new SubjectAccountError("Your subject settings could not be loaded. Please try again.", 503);
    if (!subject) throw new SubjectAccountError("This subject is not available for the connected Google account. Reload your subjects.", 404);
    if (subject.save_originals && !subject.google_originals_album_id) {
      throw new SubjectAccountError("The originals album is missing from this subject’s settings. Finish album setup before saving.", 409);
    }
    const subjectName = subject.name;

    if (ideaId) {
      if (!UUID_PATTERN.test(ideaId)) {
        throw new SubjectAccountError("The selected diary idea is not valid. Choose it again or write new text.", 400);
      }
      const { data: idea, error: ideaError } = await profileDb.from("diary_ideas").select("id")
        .eq("id", ideaId).eq("subject_id", subject.id).is("used_at", null).maybeSingle();
      if (ideaError) throw new SubjectAccountError("The selected diary idea could not be checked. Apply the diary ideas migration and retry.", 503);
      if (!idea) throw new SubjectAccountError("That diary idea has already been used or removed. Choose another idea.", 409);
    }

    const fontFamilyInput = formData.get("fontFamily");
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const safeSubjectName = sanitizeFileSegment(subjectName, "subject");
    const composed = await composeDiaryImageWithLayout({
      imageBuffer,
      subjectName,
      diaryDate,
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
    const datedDiaryImage = await addDiaryDateMetadata(composed.imageBuffer, diaryDate);
    const googleDescription = fitGooglePhotosDescription(diaryText);
    const warnings: string[] = [];
    if (googleDescription !== diaryText.trim()) {
      warnings.push("The full diary text is on the diary image and in 1PicDiary. Google Photos limits descriptions to 999 characters, so its description was shortened.");
    }
    const mediaItemId = await uploadPhotoToGooglePhotos({
      accessToken,
      albumId,
      fileName: `${safeSubjectName}-${diaryDate}-${Date.now()}.jpg`,
      imageBuffer: datedDiaryImage,
      mimeType: "image/jpeg",
      description: googleDescription,
    });

    let originalMediaItemId: string | null = null;
    if (subject.save_originals) {
      try {
        originalMediaItemId = await uploadPhotoToGooglePhotos({
          accessToken,
          albumId: subject.google_originals_album_id,
          fileName: file.name,
          imageBuffer,
          mimeType: file.type || "application/octet-stream",
          description: googleDescription,
        });
      } catch {
        warnings.push("The diary image was saved, but the original photo upload could not be confirmed. Check the originals album before retrying; do not re-upload the whole diary just to retry the original.");
      }
    }
    // The image lives only in Google Photos. Supabase keeps its reference and metadata.
    let consumedIdeaId: string | null = null;
    try {
      const diaryInsert = profileDb.from("diaries").insert({
        subject_id: subject.id,
        diary_text: diaryText,
        diary_date: diaryDate,
        text_layout: composed.textLayout,
        google_media_item_id: mediaItemId,
        google_original_media_item_id: originalMediaItemId,
      });
      const insert = ideaId ? await diaryInsert.select("id").single() : await diaryInsert;
      if (insert.error) {
        warnings.push("The image was saved to Google Photos, but the diary record could not be saved. Check the database setup; do not upload the photo again.");
      } else if (ideaId && !insert.data) {
        warnings.push("The diary was saved, but its memory-inbox item could not be linked to the diary record. You can delete that item manually.");
      } else if (ideaId && insert.data) {
        const used = await profileDb.from("diary_ideas").update({
          used_at: new Date().toISOString(), used_in_diary_id: insert.data.id,
        }).eq("id", ideaId).eq("subject_id", subject.id).is("used_at", null).select("id").maybeSingle();
        if (used.error || !used.data) {
          warnings.push("The diary was saved, but its memory-inbox item could not be marked as used. You can delete that item manually.");
        } else consumedIdeaId = ideaId;
      }
    } catch {
      warnings.push("The image was saved to Google Photos, but the diary record could not be confirmed. Check the database before retrying.");
    }

    return NextResponse.json({
      success: true,
      mediaItemId,
      originalMediaItemId,
      consumedIdeaId,
      warnings,
    });
  } catch (error) {
    const reconnectRequired =
      (error instanceof SubjectAccountError && error.status === 401) ||
      (error instanceof GooglePhotosError && (error.status === 401 || error.status === 403));
    const googlePhotoTooLarge = error instanceof GooglePhotosError && error.status === 413;

    return NextResponse.json(
      {
        error: reconnectRequired
          ? "Your Google Photos connection expired. Reconnect to continue saving this draft."
          : error instanceof Error ? error.message : "save failed",
        ...(reconnectRequired ? { reconnectRequired: true } : {}),
      },
      { status: reconnectRequired ? 401 : googlePhotoTooLarge ? 413 : error instanceof LayoutValidationError || error instanceof PhotoInputError ? 400 : error instanceof SubjectAccountError ? error.status : 500 }
    );
  }
}
