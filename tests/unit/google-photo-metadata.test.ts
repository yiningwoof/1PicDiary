import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { addDiaryDateMetadata } from "@/lib/google-photo-metadata";

describe("Google Photos diary date metadata", () => {
  it("writes the selected diary date into standard EXIF fields", async () => {
    const input = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#336699" },
    }).png().toBuffer();

    const output = await addDiaryDateMetadata(input, "2026-09-28");
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe("jpeg");
    expect(metadata.exif?.toString("latin1")).toContain("2026:09:28 12:00:00");
  });

  it("rejects an invalid diary date", async () => {
    await expect(addDiaryDateMetadata(Buffer.from("not-an-image"), "2026-02-30"))
      .rejects.toThrow("valid diary date");
  });
});
