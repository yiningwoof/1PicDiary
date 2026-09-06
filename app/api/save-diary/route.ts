import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getOrCreateAlbum, uploadPhotoToGooglePhotos } from "@/lib/google-photos";
import { composeDiaryImage, TextPosition } from "@/lib/image";
import { sanitizeFileSegment } from "@/lib/security";
import { getSupabaseServerClient } from "@/lib/supabase";

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

    const file = formData.get("photo");
    const childName = String(formData.get("childName") ?? "孩子").trim();
    const diaryText = String(formData.get("diaryText") ?? "").trim();
    const textPosition = String(formData.get("textPosition") ?? "bottom") as TextPosition;
    const albumTitle = String(formData.get("albumTitle") ?? "1PicDiary").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "photo is required" }, { status: 400 });
    }

    if (!childName || !diaryText || !albumTitle) {
      return NextResponse.json({ error: "missing required fields" }, { status: 400 });
    }

    if (!["top", "middle", "bottom"].includes(textPosition)) {
      return NextResponse.json({ error: "invalid textPosition" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const safeChildName = sanitizeFileSegment(childName, "child");
    const composed = await composeDiaryImage({
      imageBuffer,
      childName,
      diaryText,
      textPosition,
    });

    const albumId = await getOrCreateAlbum(accessToken, albumTitle);
    const mediaItemId = await uploadPhotoToGooglePhotos({
      accessToken,
      albumId,
      fileName: `${safeChildName}-${Date.now()}.png`,
      imageBuffer: composed,
    });

    const warnings: string[] = [];
    const supabase = getSupabaseServerClient();

    if (!supabase) {
      warnings.push(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    } else {
      const bucket = process.env.SUPABASE_BUCKET_NAME ?? "diary-images";
      const path = `${safeChildName}/${Date.now()}.png`;

      const upload = await supabase.storage
        .from(bucket)
        .upload(path, composed, { contentType: "image/png", upsert: false });

      if (upload.error) {
        warnings.push(`Supabase Storage upload failed: ${upload.error.message}`);
      }

      const insert = await supabase.from("diaries").insert({
        child_name: childName,
        diary_text: diaryText,
        text_position: textPosition,
        album_title: albumTitle,
        google_media_item_id: mediaItemId,
        storage_path: upload.error ? null : path,
      });

      if (insert.error) {
        warnings.push(`Supabase DB insert failed: ${insert.error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      mediaItemId,
      warnings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "save failed" },
      { status: 500 }
    );
  }
}
