import sharp from "sharp";

export type TextPosition = "top" | "middle" | "bottom";

export type ComposeDiaryImageInput = {
  imageBuffer: Buffer;
  childName: string;
  diaryText: string;
  textPosition: TextPosition;
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function composeDiaryImage({
  imageBuffer,
  childName,
  diaryText,
  textPosition,
}: ComposeDiaryImageInput): Promise<Buffer> {
  const base = sharp(imageBuffer).rotate();
  const { width = 1080, height = 1350 } = await base.metadata();

  const line = escapeXml(`${childName}：${diaryText}`.trim());
  const y =
    textPosition === "top"
      ? Math.round(height * 0.15)
      : textPosition === "middle"
        ? Math.round(height * 0.5)
        : Math.round(height * 0.85);

  const fontSize = Math.max(24, Math.round(width * 0.045));
  const shadowOffset = Math.max(2, Math.round(fontSize * 0.06));

  const overlaySvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="50%" y="${y + shadowOffset}" text-anchor="middle" fill="rgba(0,0,0,0.55)" font-size="${fontSize}" font-family="Arial, sans-serif">${line}</text>
      <text x="50%" y="${y}" text-anchor="middle" fill="white" font-size="${fontSize}" font-family="Arial, sans-serif">${line}</text>
    </svg>
  `;

  return base
    .composite([{ input: Buffer.from(overlaySvg), blend: "over" }])
    .png({ quality: 95 })
    .toBuffer();
}
