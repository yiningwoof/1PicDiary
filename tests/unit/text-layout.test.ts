import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { DEFAULT_LAYOUT, boundLayout, parseTextLayout, scaleLayout } from '@/lib/text-layout';
import { composeDiaryImageWithLayout, orientedPhoto, renderTextLayer } from '@/lib/image';

describe('text layout', () => {
  it('keeps a dragged box within the image', () => {
    const layout = boundLayout({ ...DEFAULT_LAYOUT, box: { x: -2, y: 3, width: .4, height: .2 } });
    expect(layout.box.x).toBe(.02);
    expect(layout.box.y + layout.box.height).toBeCloseTo(.98);
  });
  it('pinches around the anchor and scales font and outline together', () => {
    const layout = { ...DEFAULT_LAYOUT, box: { x: .3, y: .3, width: .3, height: .2 }, strokeWidth: .002 };
    const next = scaleLayout(layout, 1.5, { x: .45, y: .4 });
    expect(next.box.x + next.box.width / 2).toBeCloseTo(.45);
    expect(next.box.y + next.box.height / 2).toBeCloseTo(.4);
    expect(next.fontSize).toBeCloseTo(layout.fontSize * 1.5);
    expect(next.strokeWidth).toBeCloseTo(.003);
  });
  it.each([{ ...DEFAULT_LAYOUT, version: 2 }, { ...DEFAULT_LAYOUT, color: '<svg>' }, { ...DEFAULT_LAYOUT, fontSize: NaN }, '{'])('rejects malformed layouts', value => {
    expect(() => parseTextLayout(value)).toThrow();
  });
  it('does not trust client-supplied rendered text or dimensions', () => {
    expect(parseTextLayout({ ...DEFAULT_LAYOUT, renderedText: 'forged', image: { width: 1, height: 1 } })).toEqual(DEFAULT_LAYOUT);
  });
  it('reflows narrow text and reproduces the server-resolved layout exactly', async () => {
    const text = 'A: Today we walked to the park and watched the ducks.';
    const wide = await renderTextLayer(text, 1000, 800, DEFAULT_LAYOUT);
    const narrow = await renderTextLayer(text, 1000, 800, { ...DEFAULT_LAYOUT, box: { ...DEFAULT_LAYOUT.box, width: .35 } });
    expect(narrow.textLayout.box.height).toBeGreaterThan(wide.textLayout.box.height);
    const replay = await renderTextLayer(text, 1000, 800, parseTextLayout(narrow.textLayout)!);
    expect(replay.png.equals(narrow.png)).toBe(true);
    expect(replay.textLayout).toEqual(narrow.textLayout);
  });
  it('exports the exact preview layer at the resolved coordinates', async () => {
    const image = await sharp({ create: { width: 700, height: 900, channels: 3, background: '#336699' } }).png().toBuffer();
    const layer = await renderTextLayer('A: A lovely day', 700, 900, DEFAULT_LAYOUT);
    const result = await composeDiaryImageWithLayout({ imageBuffer: image, subjectName: 'A', diaryText: 'A lovely day', textPosition: 'bottom', textLayout: layer.textLayout });
    const expected = await sharp(image).composite([{ input: layer.png, left: Math.round(layer.textLayout.box.x * 700), top: Math.round(layer.textLayout.box.y * 900) }]).png().toBuffer();
    expect(result.imageBuffer.equals(expected)).toBe(true);
    expect(result.textLayout).toEqual(layer.textLayout);
  });
  it('measures the photo after EXIF orientation', async () => {
    const image = await sharp({ create: { width: 400, height: 200, channels: 3, background: 'red' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const { info } = await orientedPhoto(image);
    expect([info.width, info.height]).toEqual([200, 400]);
  });
});
