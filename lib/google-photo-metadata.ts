import sharp from "sharp";

import { isDiaryDate } from "@/lib/diary-date";

/**
 * Google Photos does not expose a writable creationTime field during upload.
 * Embed the diary day in the uploaded diary image so Photos can derive its
 * displayed date from standard photo metadata.
 */
export async function addDiaryDateMetadata(imageBuffer: Buffer, diaryDate: string) {
  if (!isDiaryDate(diaryDate)) {
    throw new Error("A valid diary date is required for photo metadata");
  }

  const exifDate = `${diaryDate.replaceAll("-", ":")} 12:00:00`;

  return sharp(imageBuffer)
    .withExif({
      IFD0: { DateTime: exifDate },
      IFD2: {
        DateTimeOriginal: exifDate,
        DateTimeDigitized: exifDate,
      },
    })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
