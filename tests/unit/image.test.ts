import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { composeDiaryImage } from "@/lib/image";

describe("composeDiaryImage", () => {
  it("composes diary text onto the source image", async () => {
    const input = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: "#336699",
      },
    })
      .png()
      .toBuffer();

    const output = await composeDiaryImage({
      imageBuffer: input,
      childName: "大宝",
      diaryText: "今天很开心",
      textPosition: "bottom",
    });

    const metadata = await sharp(output).metadata();

    expect(output.byteLength).toBeGreaterThan(0);
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(200);
  });
});
