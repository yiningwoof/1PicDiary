import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { DEFAULT_LAYOUT, MAX_LAYOUT_FONT_SIZE, boundLayout, parseTextLayout, resizeLayoutHeightFromTop, resizeLayoutWidth, scaleLayout } from '@/lib/text-layout';
import { composeDiaryImageWithLayout, orientedPhoto, renderTextLayer } from '@/lib/image';

describe('text layout', () => {
  it('defaults to bold, outlined, left-aligned text', () => {
    expect(DEFAULT_LAYOUT).toMatchObject({
      fontFamily: 'sans', fontWeight: 'bold', alignment: 'left',
      color: '#ffffff', strokeColor: '#000000',
    });
    expect(DEFAULT_LAYOUT.strokeWidth).toBeGreaterThan(0);
  });
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
  it('resizes width independently and requests an automatic best fit', () => {
    const wider = resizeLayoutWidth(DEFAULT_LAYOUT, -.2);
    expect(wider.box.width).toBeCloseTo(DEFAULT_LAYOUT.box.width - .2);
    expect(wider.box.height).toBe(DEFAULT_LAYOUT.box.height);
    expect(wider.fontSize).toBe(MAX_LAYOUT_FONT_SIZE);
  });
  it('resizes from the top while keeping the bottom edge fixed', () => {
    const resized = resizeLayoutHeightFromTop(DEFAULT_LAYOUT, -.08);
    expect(resized.box.y).toBeCloseTo(DEFAULT_LAYOUT.box.y - .08);
    expect(resized.box.y + resized.box.height).toBeCloseTo(DEFAULT_LAYOUT.box.y + DEFAULT_LAYOUT.box.height);
    expect(resized.box.width).toBe(DEFAULT_LAYOUT.box.width);
    expect(resized.fontSize).toBe(MAX_LAYOUT_FONT_SIZE);
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
    expect(narrow.textLayout.box.height).toBeCloseTo(DEFAULT_LAYOUT.box.height);
    expect(wide.textLayout.box.height).toBeCloseTo(DEFAULT_LAYOUT.box.height);
    expect(narrow.textLayout.fontSize).toBeLessThanOrEqual(wide.textLayout.fontSize);
    const replay = await renderTextLayer(text, 1000, 800, parseTextLayout(narrow.textLayout)!);
    expect(replay.png.equals(narrow.png)).toBe(true);
    expect(replay.textLayout).toEqual(narrow.textLayout);
  });
  it('preserves an independently resized height and fits text inside it', async () => {
    const text = 'A: Today we walked to the park and watched the ducks together.';
    const tall = await renderTextLayer(text, 1000, 800, { ...DEFAULT_LAYOUT, box: { ...DEFAULT_LAYOUT.box, height: .3 } });
    const short = await renderTextLayer(text, 1000, 800, { ...DEFAULT_LAYOUT, box: { ...DEFAULT_LAYOUT.box, height: .1 } });
    expect(tall.textLayout.box.height).toBeCloseTo(.3);
    expect(short.textLayout.box.height).toBeCloseTo(.1);
    expect(short.textLayout.fontSize).toBeLessThan(tall.textLayout.fontSize);
  });
  it('uses newly available width and height to maximize the fitted font', async () => {
    const text = '11/12/2026\n今天 nanny Janie 来看我们啦，妈妈在布局中希望文字尽量填满空间。';
    const small = await renderTextLayer(text, 1000, 1200, { ...DEFAULT_LAYOUT, fontSize: MAX_LAYOUT_FONT_SIZE, box: { ...DEFAULT_LAYOUT.box, width: .45, height: .12 } });
    const large = await renderTextLayer(text, 1000, 1200, { ...DEFAULT_LAYOUT, fontSize: MAX_LAYOUT_FONT_SIZE, box: { ...DEFAULT_LAYOUT.box, width: .75, height: .25 } });
    expect(large.textLayout.fontSize).toBeGreaterThan(small.textLayout.fontSize);
    expect(large.textLayout.fontSize).toBeLessThanOrEqual(MAX_LAYOUT_FONT_SIZE);
  });
  it('resizes the textbox when the user chooses a font size', async () => {
    const text = '11/27/2026\n今天学会自己穿鞋了';
    const initial = await renderTextLayer(text, 1000, 1200, DEFAULT_LAYOUT);
    const requestedFontSize = initial.textLayout.fontSize * 1.5;
    const resized = await renderTextLayer(text, 1000, 1200, {
      ...initial.textLayout, fontSize: requestedFontSize,
    }, { resizeBoxToFont: true });
    expect(resized.textLayout.fontSize).toBeCloseTo(requestedFontSize, 4);
    expect(resized.textLayout.box.height).toBeGreaterThan(initial.textLayout.box.height);
    expect(resized.textLayout.box.y + resized.textLayout.box.height)
      .toBeCloseTo(initial.textLayout.box.y + initial.textLayout.box.height, 3);
  });
  it('exports the exact preview layer at the resolved coordinates', async () => {
    const image = await sharp({ create: { width: 700, height: 900, channels: 3, background: '#336699' } }).png().toBuffer();
    const layer = await renderTextLayer('9/1/2026\nA lovely day', 700, 900, DEFAULT_LAYOUT);
    const result = await composeDiaryImageWithLayout({ imageBuffer: image, subjectName: 'A', diaryDate: '2026-09-01', diaryText: 'A lovely day', textPosition: 'bottom', textLayout: layer.textLayout });
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
