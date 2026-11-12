import { describe, expect, it } from "vitest";
import {
  exceedsGooglePhotosPhotoLimit,
  GOOGLE_PHOTOS_MAX_PHOTO_BYTES,
} from "@/lib/upload-limits";

describe("Google Photos photo size limit", () => {
  it("accepts 200 MB and rejects anything larger", () => {
    expect(exceedsGooglePhotosPhotoLimit(GOOGLE_PHOTOS_MAX_PHOTO_BYTES)).toBe(false);
    expect(exceedsGooglePhotosPhotoLimit(GOOGLE_PHOTOS_MAX_PHOTO_BYTES + 1)).toBe(true);
  });
});
