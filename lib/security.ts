export function sanitizeFileSegment(input: string, fallback = "item") {
  const safe = input
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return safe || fallback;
}
