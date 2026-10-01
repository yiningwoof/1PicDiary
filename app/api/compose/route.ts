import { parseTextLayout, LayoutValidationError } from '@/lib/text-layout';
import { NextResponse } from "next/server";

import {
  composeDiaryImage,
  isFontFamilyKey,
  resolveFontScale,
  resolveStrokeColor,
  resolveStrokeWidth,
  resolveTextColor,
  TextPosition,
} from "@/lib/image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const textLayout = parseTextLayout(formData.get("textLayout"));
    const file = formData.get("photo");
    const subjectName = String(formData.get("subjectName") ?? "Subject");
    const diaryText = String(formData.get("diaryText") ?? "").trim();
    const textPosition = String(formData.get("textPosition") ?? "bottom") as TextPosition;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "photo is required" }, { status: 400 });
    }

    if (!diaryText.trim()) {
      return NextResponse.json({ error: "diaryText is required" }, { status: 400 });
    }

    if (!["top", "middle", "bottom"].includes(textPosition)) {
      return NextResponse.json({ error: "invalid textPosition" }, { status: 400 });
    }

    if (file.size > 30 * 1024 * 1024 || diaryText.length > 80 || subjectName.length > 80) {
      return NextResponse.json({ error: 'Choose a photo up to 30 MB and a diary line up to 80 characters.' }, { status: 400 });
    }
    const fontFamilyInput = formData.get("fontFamily");
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const composed = await composeDiaryImage({
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

    return new Response(new Uint8Array(composed), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "compose failed" },
      { status: error instanceof LayoutValidationError ? 400 : 500 }
    );
  }
}
