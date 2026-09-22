import sharp from "sharp";
import { DEFAULT_LAYOUT, boundLayout, clamp, type TextLayout } from "@/lib/text-layout";

export type TextPosition = "top" | "middle" | "bottom";

/**
 * Font stacks are stored server-side and referenced by key so that no
 * caller-supplied string is ever interpolated into the overlay SVG.
 */
export const FONT_FAMILIES = {
  sans: '"PingFang SC","Hiragino Sans GB","Heiti SC","Microsoft YaHei",Arial,sans-serif',
  serif: '"Songti SC","STSong","SimSun","Noto Serif CJK SC",Georgia,serif',
  rounded: '"Arial Rounded MT Bold","Quicksand","PingFang SC",Verdana,sans-serif',
  mono: '"SFMono-Regular","Menlo","Courier New",monospace',
} as const;

export type FontFamilyKey = keyof typeof FONT_FAMILIES;

export const DEFAULT_FONT_FAMILY: FontFamilyKey = "sans";
export const DEFAULT_TEXT_COLOR = "#ffffff";
export const DEFAULT_FONT_SCALE = 1;
export const DEFAULT_STROKE_COLOR = "#000000";
export const DEFAULT_STROKE_WIDTH = 0;

const MIN_FONT_SCALE = 0.6;
const MAX_FONT_SCALE = 2.5;
const MIN_STROKE_WIDTH = 0;
const MAX_STROKE_WIDTH = 12;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isFontFamilyKey(value: unknown): value is FontFamilyKey {
  return typeof value === "string" && value in FONT_FAMILIES;
}

export function resolveFontFamily(value: unknown): string {
  return FONT_FAMILIES[isFontFamilyKey(value) ? value : DEFAULT_FONT_FAMILY];
}

export function resolveTextColor(value: unknown): string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
    ? value.toLowerCase()
    : DEFAULT_TEXT_COLOR;
}

export function resolveStrokeColor(value: unknown): string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value)
    ? value.toLowerCase()
    : DEFAULT_STROKE_COLOR;
}

export function resolveStrokeWidth(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_STROKE_WIDTH;
  }

  return Math.min(MAX_STROKE_WIDTH, Math.max(MIN_STROKE_WIDTH, parsed));
}

export function resolveFontScale(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_FONT_SCALE;
  }

  return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, parsed));
}

export type ComposeDiaryImageInput = {
  imageBuffer: Buffer;
  subjectName: string;
  diaryText: string;
  textPosition: TextPosition;
  textLayout?: TextLayout;
  fontFamily?: FontFamilyKey;
  fontScale?: number;
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * CJK, kana and full-width punctuation occupy roughly one em, while Latin
 * glyphs average a little over half of that.
 */
function isWideCharacter(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;

  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x3fffd)
  );
}

/**
 * Sharp rasterises the overlay without exposing font metrics, so line widths
 * are estimated. The estimate is deliberately generous to avoid overflow.
 */
function measureText(text: string, fontSize: number): number {
  let total = 0;

  for (const char of text) {
    total += isWideCharacter(char) ? fontSize : fontSize * 0.55;
  }

  return total;
}

/**
 * Splits text into atomic units: single wide characters, single spaces, and
 * runs of narrow characters, so Latin words stay intact but CJK can break
 * anywhere. Units wider than a full line are split per character.
 */
function tokenize(text: string, fontSize: number, maxWidth: number): string[] {
  const tokens: string[] = [];
  let buffer = "";

  const flush = () => {
    if (!buffer) {
      return;
    }

    if (measureText(buffer, fontSize) > maxWidth) {
      tokens.push(...Array.from(buffer));
    } else {
      tokens.push(buffer);
    }

    buffer = "";
  };

  for (const char of text) {
    if (char === " " || isWideCharacter(char)) {
      flush();
      tokens.push(char);
    } else {
      buffer += char;
    }
  }

  flush();

  return tokens;
}

export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";

  for (const token of tokenize(text, fontSize, maxWidth)) {
    const candidate = current + token;

    if (current && measureText(candidate, fontSize) > maxWidth) {
      lines.push(current.trimEnd());
      current = token === " " ? "" : token;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    lines.push(current.trimEnd());
  }

  return lines.length > 0 ? lines : [text];
}

/** Normalize EXIF orientation before measuring or placing anything. */
export async function orientedPhoto(imageBuffer: Buffer) {
  return sharp(imageBuffer, { limitInputPixels: 60_000_000 }).rotate().png().toBuffer({ resolveWithObject: true });
}

export function layoutFromLegacy(input: Omit<ComposeDiaryImageInput, 'imageBuffer'>, width: number): TextLayout {
  return { ...DEFAULT_LAYOUT, box: { ...DEFAULT_LAYOUT.box,
    y: input.textPosition === 'top' ? 0.08 : input.textPosition === 'middle' ? 0.4 : 0.72,
  }, fontFamily: isFontFamilyKey(input.fontFamily) ? input.fontFamily : 'sans',
    fontSize: 0.045 * resolveFontScale(input.fontScale), color: resolveTextColor(input.textColor),
    strokeColor: resolveStrokeColor(input.strokeColor), strokeWidth: resolveStrokeWidth(input.strokeWidth) / width,
  };
}

/** The editor displays this very same raster layer; export composites it at the saved coordinates. */
export async function renderTextLayer(text: string, width: number, height: number, requested: TextLayout) {
  const layout = boundLayout(requested);
  const marginX = Math.ceil(width * 0.02);
  const marginY = Math.ceil(height * 0.02);
  const pixelWidth = Math.max(1, Math.min(width - 2 * marginX, Math.round(layout.box.width * width)));
  const outline = Math.max(0, layout.strokeWidth * width);
  let fontSize = Math.max(1, layout.fontSize * width);
  let padding = 0;
  let lines: string[] = [];
  let pixelHeight = 0;
  // Text reflows on width changes. Shrink only if its entire block cannot fit the image.
  for (let attempt = 0; attempt < 150; attempt++) {
    padding = Math.ceil(fontSize * 0.3 + outline + 2);
    lines = wrapText(text, fontSize, Math.max(1, pixelWidth - 2 * padding));
    pixelHeight = Math.ceil(lines.length * fontSize * 1.4 + 2 * padding);
    if (pixelHeight <= (height - 2 * marginY) && padding * 2 < pixelWidth) break;
    fontSize *= 0.9;
  }
  if (pixelHeight > height - 2 * marginY || padding * 2 >= pixelWidth) {
    throw new Error('This image is too small for the text and outline. Reduce the outline or use a larger image.');
  }
  const x = clamp(Math.round(layout.box.x * width), marginX, width - marginX - pixelWidth);
  const y = clamp(Math.round(layout.box.y * height), marginY, height - marginY - pixelHeight);
  const finalLayout: TextLayout = { ...layout,
    box: { x: x / width, y: y / height, width: pixelWidth / width, height: pixelHeight / height },
    fontSize: fontSize / width, image: { width, height }, renderedText: text,
  };
  const font = resolveFontFamily(layout.fontFamily);
  const stroke = outline > 0 ? ` stroke="${layout.strokeColor}" stroke-width="${outline}" stroke-linejoin="round" paint-order="stroke fill"` : '';
  const rendered = lines.map((line, index) => {
    const baseline = padding + fontSize * 1.05 + index * fontSize * 1.4;
    const shadow = outline > 0 ? '' : `<text x="50%" y="${baseline + Math.max(1, fontSize * 0.06)}" text-anchor="middle" fill="rgba(0,0,0,0.55)" font-size="${fontSize}" font-family='${font}'>${escapeXml(line)}</text>`;
    return `${shadow}<text x="50%" y="${baseline}" text-anchor="middle" fill="${layout.color}" font-size="${fontSize}" font-family='${font}'${stroke}>${escapeXml(line)}</text>`;
  }).join('');
  const svg = `<svg width="${pixelWidth}" height="${pixelHeight}" xmlns="http://www.w3.org/2000/svg">${rendered}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { png, textLayout: finalLayout };
}

export async function composeDiaryImageWithLayout(input: ComposeDiaryImageInput) {
  const { data, info } = await orientedPhoto(input.imageBuffer);
  const layout = input.textLayout ?? layoutFromLegacy(input, info.width);
  const { png, textLayout } = await renderTextLayer(`${input.subjectName}: ${input.diaryText}`.trim(), info.width, info.height, layout);
  const imageBuffer = await sharp(data).composite([{ input: png,
    left: Math.round(textLayout.box.x * info.width), top: Math.round(textLayout.box.y * info.height),
  }]).png().toBuffer();
  return { imageBuffer, textLayout };
}

export async function composeDiaryImage(input: ComposeDiaryImageInput): Promise<Buffer> {
  return (await composeDiaryImageWithLayout(input)).imageBuffer;
}
