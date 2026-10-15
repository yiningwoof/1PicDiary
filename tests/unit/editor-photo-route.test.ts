import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/editor-photo/route";

function requestFor(file: File) {
  const form = new FormData();
  form.set("photo", file);
  return new Request("http://localhost/api/editor-photo", { method: "POST", body: form });
}

describe("POST /api/editor-photo", () => {
  it("reports the encoded format separately from the extension and browser MIME type", async () => {
    const jpeg = await sharp({
      create: { width: 64, height: 48, channels: 3, background: "#336699" },
    }).jpeg().toBuffer();
    const file = new File([jpeg], "oneplus-photo.heic", { type: "image/heic" });

    const response = await POST(requestFor(file));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversion).toMatchObject({
      fileName: "oneplus-photo.heic",
      extension: ".heic",
      reportedMimeType: "image/heic",
      detectedFormat: "JPEG",
      editingFormat: "PNG",
    });
  });

  it("returns diagnostic details when jpg-named bytes are not an image", async () => {
    const file = new File(["not actually a photo"], "broken.jpg", { type: "image/jpeg" });

    const response = await POST(requestFor(file));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual({
      fileName: "broken.jpg",
      extension: ".jpg",
      reportedMimeType: "image/jpeg",
      detectedFormat: "Unknown",
      reason: "unsupported-format",
    });
  });
});
