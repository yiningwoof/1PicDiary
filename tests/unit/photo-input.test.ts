import { describe, expect, it } from "vitest";

import { detectPhotoFormat, isHeifContainer } from "@/lib/photo-input";

function ftyp(...brands: string[]) {
  const payload = Buffer.from(brands.join(""), "ascii");
  const result = Buffer.alloc(8 + payload.length);
  result.writeUInt32BE(result.length, 0);
  result.write("ftyp", 4, "ascii");
  payload.copy(result, 8);
  return result;
}

describe("isHeifContainer", () => {
  it.each(["heic", "heix", "mif1", "avif"])("recognizes the %s brand", (brand) => {
    expect(isHeifContainer(ftyp(brand, "mif1"))).toBe(true);
  });

  it("recognizes a compatible HEIC brand", () => {
    expect(isHeifContainer(ftyp("xxxx", "heic"))).toBe(true);
  });

  it("does not trust the file extension or arbitrary bytes", () => {
    expect(isHeifContainer(Buffer.from("photo.heic"))).toBe(false);
    expect(isHeifContainer(ftyp("mp42", "isom"))).toBe(false);
  });
});

describe("detectPhotoFormat", () => {
  it.each([
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "JPEG"],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "PNG"],
    [Buffer.from("GIF89a", "ascii"), "GIF"],
    [Buffer.from("II*\u0000", "binary"), "TIFF"],
    [ftyp("avif", "mif1"), "AVIF"],
    [ftyp("heic", "mif1"), "HEIC/HEIF"],
  ])("identifies encoded bytes as %s", (input, expected) => {
    expect(detectPhotoFormat(input as Buffer)).toBe(expected);
  });

  it("reports unknown bytes instead of trusting a jpg-looking name", () => {
    expect(detectPhotoFormat(Buffer.from("photo.jpg"))).toBe("Unknown");
  });
});
