import libheif, { type HeifImage } from "libheif-js";
import sharp from "sharp";

const MAX_INPUT_PIXELS = 60_000_000;
type DisplayedImage = { data: Uint8ClampedArray; width: number; height: number };
export type PhotoFormat = "JPEG" | "PNG" | "WebP" | "AVIF" | "HEIC/HEIF" | "TIFF" | "GIF" | "Unknown";
export type PhotoFailureReason = "unsupported-format" | "invalid-image-data" | "unsupported-codec" | "too-large" | "no-still-image";
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "avif",
  "avis",
]);

export class PhotoInputError extends Error {
  detectedFormat: PhotoFormat;
  reason: PhotoFailureReason;

  constructor(
    message = "This photo format is not supported or the file is damaged.",
    options: { detectedFormat?: PhotoFormat; reason?: PhotoFailureReason } = {},
  ) {
    super(message);
    this.name = "PhotoInputError";
    this.detectedFormat = options.detectedFormat ?? "Unknown";
    this.reason = options.reason ?? "unsupported-format";
  }
}

function isoMediaBrands(buffer: Buffer): string[] {
  if (buffer.length < 16 || buffer.toString("ascii", 4, 8) !== "ftyp") {
    return [];
  }

  const declaredSize = buffer.readUInt32BE(0);
  const boxEnd = Math.min(buffer.length, declaredSize >= 16 ? declaredSize : 32, 128);
  const brands: string[] = [];

  for (let offset = 8; offset + 4 <= boxEnd; offset += 4) {
    brands.push(buffer.toString("ascii", offset, offset + 4).toLowerCase());
  }

  return brands;
}

/** Read the ISO Base Media File Format brands used by HEIC, HEIF, and AVIF. */
export function isHeifContainer(buffer: Buffer): boolean {
  return isoMediaBrands(buffer).some((brand) => HEIF_BRANDS.has(brand));
}

/** Detect actual encoded content from magic bytes instead of trusting a filename. */
export function detectPhotoFormat(buffer: Buffer): PhotoFormat {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "JPEG";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "PNG";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "WebP";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) return "GIF";
  if (buffer.length >= 4 && ["II*\u0000", "MM\u0000*"].includes(buffer.toString("binary", 0, 4))) return "TIFF";

  const brands = isoMediaBrands(buffer);
  if (brands.some((brand) => ["avif", "avis"].includes(brand))) return "AVIF";
  if (brands.some((brand) => HEIF_BRANDS.has(brand))) return "HEIC/HEIF";
  return "Unknown";
}

async function decodeHeif(buffer: Buffer): Promise<Buffer> {
  const decoder = new libheif.HeifDecoder();
  let images: HeifImage[] = [];

  try {
    images = decoder.decode(buffer);
    const image = images[0];
    if (!image) {
      throw new PhotoInputError("The HEIC/HEIF file does not contain an editable still image.", {
        detectedFormat: "HEIC/HEIF", reason: "no-still-image",
      });
    }

    const width = image.get_width();
    const height = image.get_height();
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width * height > MAX_INPUT_PIXELS
    ) {
      throw new PhotoInputError("The HEIC/HEIF photo is over the 60-megapixel editing limit.", {
        detectedFormat: "HEIC/HEIF", reason: "too-large",
      });
    }

    const target = {
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    };
    const displayed = await new Promise<DisplayedImage>((resolve, reject) => {
      image.display(target, (result) => {
        if (result) resolve(result);
        else reject(new PhotoInputError("The HEIC/HEIF still image uses a codec or profile this server cannot decode.", {
          detectedFormat: "HEIC/HEIF", reason: "unsupported-codec",
        }));
      });
    });

    return sharp(Buffer.from(displayed.data), {
      raw: { width, height, channels: 4 },
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .png()
      .toBuffer();
  } catch (error) {
    if (error instanceof PhotoInputError) throw error;
    throw new PhotoInputError("The file is HEIC/HEIF, but its image data is damaged or uses an unsupported codec.", {
      detectedFormat: "HEIC/HEIF", reason: "unsupported-codec",
    });
  } finally {
    for (const image of images) image.free();
  }
}

/**
 * Normalize a phone photo to an oriented PNG. Sharp handles the common raster
 * formats; libheif is a fallback for HEIC/HEIF files whose HEVC codec is not
 * included in Sharp's prebuilt binaries.
 */
export async function orientedPhoto(imageBuffer: Buffer) {
  const detectedFormat = detectPhotoFormat(imageBuffer);
  try {
    const normalized = await sharp(imageBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .png()
      .toBuffer({ resolveWithObject: true });
    return { ...normalized, sourceFormat: detectedFormat, outputFormat: "PNG" as const, decoder: "Sharp" as const };
  } catch (error) {
    if (!isHeifContainer(imageBuffer)) {
      const processingMessage = error instanceof Error ? error.message : "";
      if (/pixel limit|exceeds.*limit|image too large/i.test(processingMessage)) {
        throw new PhotoInputError(`The ${detectedFormat} photo is over the 60-megapixel editing limit.`, {
          detectedFormat, reason: "too-large",
        });
      }
      if (detectedFormat === "Unknown") {
        throw new PhotoInputError("The file contents do not match a supported photo format.", {
          detectedFormat, reason: "unsupported-format",
        });
      }
      throw new PhotoInputError(`The file header identifies ${detectedFormat}, but its image data is incomplete, damaged, or uses an unsupported encoding.`, {
        detectedFormat, reason: "invalid-image-data",
      });
    }

    const decoded = await decodeHeif(imageBuffer);
    const normalized = await sharp(decoded, { limitInputPixels: MAX_INPUT_PIXELS })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { ...normalized, sourceFormat: detectedFormat, outputFormat: "PNG" as const, decoder: "libheif" as const };
  }
}
