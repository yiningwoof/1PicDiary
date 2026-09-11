import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { composeDiaryImage, wrapText } from "@/lib/image";

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

  it("renders different output for different font options", async () => {
    const input = await sharp({
      create: {
        width: 600,
        height: 600,
        channels: 3,
        background: "#336699",
      },
    })
      .png()
      .toBuffer();

    const baseOptions = {
      imageBuffer: input,
      childName: "大宝",
      diaryText: "今天很开心",
      textPosition: "bottom" as const,
    };

    const small = await composeDiaryImage({ ...baseOptions, fontScale: 0.6 });
    const large = await composeDiaryImage({ ...baseOptions, fontScale: 2.5 });
    const redText = await composeDiaryImage({ ...baseOptions, textColor: "#ff0000" });
    const serifText = await composeDiaryImage({ ...baseOptions, fontFamily: "serif" });

    expect(small.equals(large)).toBe(false);
    expect(redText.equals(serifText)).toBe(false);
  });

  it("renders an outline when stroke width is set", async () => {
    const input = await sharp({
      create: {
        width: 600,
        height: 600,
        channels: 3,
        background: "#336699",
      },
    })
      .png()
      .toBuffer();

    const baseOptions = {
      imageBuffer: input,
      childName: "大宝",
      diaryText: "今天很开心",
      textPosition: "bottom" as const,
    };

    const noOutline = await composeDiaryImage({ ...baseOptions, strokeWidth: 0 });
    const redOutline = await composeDiaryImage({
      ...baseOptions,
      strokeWidth: 6,
      strokeColor: "#ff0000",
    });
    const blueOutline = await composeDiaryImage({
      ...baseOptions,
      strokeWidth: 6,
      strokeColor: "#0000ff",
    });

    expect(redOutline.equals(noOutline)).toBe(false);
    expect(redOutline.equals(blueOutline)).toBe(false);
  });

  it("clamps out-of-range stroke width and rejects invalid stroke color", async () => {
    const input = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 3,
        background: "#336699",
      },
    })
      .png()
      .toBuffer();

    const baseOptions = {
      imageBuffer: input,
      childName: "大宝",
      diaryText: "今天很开心",
      textPosition: "bottom" as const,
    };

    const clamped = await composeDiaryImage({ ...baseOptions, strokeWidth: 9999 });
    const maxWidth = await composeDiaryImage({ ...baseOptions, strokeWidth: 12 });
    const injected = await composeDiaryImage({
      ...baseOptions,
      strokeWidth: 6,
      strokeColor: '"/><script>alert(1)</script>',
    });
    const blackOutline = await composeDiaryImage({
      ...baseOptions,
      strokeWidth: 6,
      strokeColor: "#000000",
    });

    expect(clamped.equals(maxWidth)).toBe(true);
    expect(injected.equals(blackOutline)).toBe(true);
  });

  it("falls back to safe defaults for invalid font input", async () => {
    const input = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: "#336699",
      },
    })
      .png()
      .toBuffer();

    const baseOptions = {
      imageBuffer: input,
      childName: "大宝",
      diaryText: "今天很开心",
      textPosition: "bottom" as const,
    };

    const injected = await composeDiaryImage({
      ...baseOptions,
      textColor: "'/><script>alert(1)</script>",
    });
    const defaults = await composeDiaryImage(baseOptions);

    const metadata = await sharp(injected).metadata();

    expect(injected.equals(defaults)).toBe(true);
    expect(metadata.width).toBe(300);
  });
});

describe("wrapText", () => {
  it("keeps a short line intact", () => {
    expect(wrapText("大宝: 今天很开心", 40, 2000)).toEqual(["大宝: 今天很开心"]);
  });

  it("breaks long latin text at spaces without splitting words", () => {
    const lines = wrapText(
      "We went to the park and played on the swings all afternoon",
      40,
      400,
    );

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ").split(/\s+/)).toEqual(
      "We went to the park and played on the swings all afternoon".split(" "),
    );
  });

  it("breaks CJK text between characters", () => {
    const text = "今天我们去公园玩了很久还吃了冰淇淋非常开心";
    const lines = wrapText(text, 40, 400);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(text);
  });

  it("splits a single word that is wider than the line", () => {
    const lines = wrapText("Supercalifragilisticexpialidocious", 40, 200);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("Supercalifragilisticexpialidocious");
  });
});

describe("composeDiaryImage with long text", () => {
  it("wraps long text and keeps the image dimensions unchanged", async () => {
    const input = await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 3,
        background: "#336699",
      },
    })
      .png()
      .toBuffer();

    const baseOptions = {
      imageBuffer: input,
      childName: "大宝",
      textPosition: "bottom" as const,
    };

    const short = await composeDiaryImage({
      ...baseOptions,
      diaryText: "今天很开心",
    });
    const long = await composeDiaryImage({
      ...baseOptions,
      diaryText:
        "今天我们一起去了公园，先玩了滑梯又荡了秋千，后来还在草地上追蝴蝶，回家的路上吃了一个甜筒，是非常非常开心的一天。",
    });

    const longMetadata = await sharp(long).metadata();

    expect(long.equals(short)).toBe(false);
    expect(longMetadata.width).toBe(800);
    expect(longMetadata.height).toBe(800);
  });

  it("shrinks text that would otherwise overflow the frame", async () => {
    const input = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 3,
        background: "#336699",
      },
    })
      .png()
      .toBuffer();

    const output = await composeDiaryImage({
      imageBuffer: input,
      childName: "大宝",
      diaryText: "今天很开心".repeat(60),
      textPosition: "middle",
      fontScale: 2.5,
    });

    const metadata = await sharp(output).metadata();

    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(400);
  });
});
