import { NextResponse } from "next/server";

import { composeDiaryImage, TextPosition } from "@/lib/image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("photo");
    const childName = String(formData.get("childName") ?? "孩子");
    const diaryText = String(formData.get("diaryText") ?? "");
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

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const composed = await composeDiaryImage({
      imageBuffer,
      childName,
      diaryText,
      textPosition,
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
      { status: 500 }
    );
  }
}
