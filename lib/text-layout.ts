export type LayoutFont = 'sans' | 'serif' | 'rounded' | 'mono';

/** Coordinates use the auto-oriented image. Font/outline sizes are fractions of its width. */
export type TextLayout = {
  version: 1;
  source: 'manual' | 'ai';
  box: { x: number; y: number; width: number; height: number };
  fontFamily: LayoutFont;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  alignment: 'center';
  renderedText?: string;
  image?: { width: number; height: number };
};

export const DEFAULT_LAYOUT: TextLayout = {
  version: 1, source: 'manual', box: { x: 0.05, y: 0.72, width: 0.9, height: 0.15 },
  fontFamily: 'sans', fontSize: 0.045, color: '#ffffff', strokeColor: '#000000',
  strokeWidth: 0, alignment: 'center',
};
export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function boundLayout(layout: TextLayout): TextLayout {
  const width = clamp(layout.box.width, 0.15, 0.96);
  const height = clamp(layout.box.height, 0.001, 0.96);
  return { ...layout, box: { width, height,
    x: clamp(layout.box.x, 0.02, 0.98 - width),
    y: clamp(layout.box.y, 0.02, 0.98 - height),
  } };
}

export type Point = { x: number; y: number };
export function scaleLayout(layout: TextLayout, factor: number, anchor: Point): TextLayout {
  const scale = clamp(factor, 0.008 / layout.fontSize, 0.16 / layout.fontSize);
  const width = clamp(layout.box.width * scale, 0.15, 0.96);
  const height = clamp(layout.box.height * scale, 0.001, 0.96);
  return boundLayout({ ...layout, source: 'manual', fontSize: layout.fontSize * scale,
    strokeWidth: clamp(layout.strokeWidth * scale, 0, 0.02),
    box: { x: anchor.x + (layout.box.x - anchor.x) * (width / layout.box.width),
      y: anchor.y + (layout.box.y - anchor.y) * (height / layout.box.height), width, height },
  });
}

export class LayoutValidationError extends Error {}
export function parseTextLayout(input: unknown): TextLayout | undefined {
  if (input == null || input === '') return undefined;
  let value: unknown = input;
  if (typeof input === 'string') {
    try { value = JSON.parse(input); } catch { throw new LayoutValidationError('Invalid text layout.'); }
  }
  if (!value || typeof value !== 'object') throw new LayoutValidationError('Invalid text layout.');
  const obj = value as Record<string, unknown>;
  const box = obj.box as Record<string, unknown> | undefined;
  const numeric = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  const color = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
  if (obj.version !== 1 || !['manual', 'ai'].includes(String(obj.source)) || !box ||
      !['x', 'y', 'width', 'height'].every(k => numeric(box[k])) ||
      !numeric(obj.fontSize) || !numeric(obj.strokeWidth) ||
      !['sans', 'serif', 'rounded', 'mono'].includes(String(obj.fontFamily)) ||
      !color(obj.color) || !color(obj.strokeColor) || obj.alignment !== 'center') {
    throw new LayoutValidationError('Invalid text layout. Please reset the text and try again.');
  }
  return boundLayout({ version: 1, source: obj.source as TextLayout['source'],
    box: { x: box.x as number, y: box.y as number, width: box.width as number, height: box.height as number },
    fontFamily: obj.fontFamily as LayoutFont, fontSize: clamp(obj.fontSize, 0.001, 0.16),
    color: obj.color, strokeColor: obj.strokeColor, strokeWidth: clamp(obj.strokeWidth, 0, 0.02), alignment: 'center',
  });
}
