'use client';

import { useEffect, useId, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DEFAULT_LAYOUT, boundLayout, clamp, scaleLayout, type Point, type TextLayout } from '@/lib/text-layout';

type PhotoPreview = { url: string; width: number; height: number };
type Layer = { url: string; key: string };
type Gesture = { layout: TextLayout; points: Point[]; width: boolean };

function rasterKey(text: string, photo: PhotoPreview | null, layout: TextLayout) {
  // Moving a layer never requires another text-render request.
  return JSON.stringify([text, photo?.width, photo?.height, layout.box.width,
    layout.fontFamily, layout.fontSize, layout.color, layout.strokeColor, layout.strokeWidth]);
}
const center = (points: Point[]): Point => points.length > 1
  ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];

export function TextLayoutEditor({ photo, text, disabled, onChange }: {
  photo: File; text: string; disabled: boolean;
  onChange: (layout: TextLayout | null, ready: boolean) => void;
}) {
  const id = useId();
  const [source, setSource] = useState<PhotoPreview | null>(null);
  const [layout, setLayout] = useState<TextLayout>(DEFAULT_LAYOUT);
  const [layer, setLayer] = useState<Layer | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [gesturing, setGesturing] = useState(false);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [layerLoaded, setLayerLoaded] = useState('');
  const frame = useRef<HTMLDivElement>(null);
  const current = useRef(layout);
  const points = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const signature = rasterKey(text, source, layout);
  const ready = Boolean(source && sourceLoaded && layer && layer.key === signature && layerLoaded === layer.url && !error && !gesturing);

  function update(next: TextLayout) {
    const bounded = boundLayout({ ...next, source: 'manual' });
    current.current = bounded;
    setLayout(bounded);
  }

  useEffect(() => {
    const controller = new AbortController();
    const form = new FormData();
    form.set('photo', photo);
    async function prepare() {
      try {
        const response = await fetch('/api/editor-photo', { method: 'POST', body: form, signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Could not open this image.');
        if (!controller.signal.aborted) { setSource(result); setError(''); }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not open this image.');
      }
    }
    void prepare();
    return () => controller.abort();
  }, [photo, retry]);

  useEffect(() => {
    if (!source || !text.trim() || gesturing || layer?.key === signature) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/text-overlay', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ text, width: source.width, height: source.height, layout: current.current }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Could not render text.');
        if (controller.signal.aborted) return;
        const resolved: TextLayout = result.layout;
        // Keep the latest drag position even when a raster request was already in flight.
        const next = boundLayout({ ...resolved, box: { ...resolved.box, x: current.current.box.x, y: current.current.box.y } });
        current.current = next;
        setLayout(next);
        setLayer({ url: result.url, key: rasterKey(text, source, next) });
        setError('');
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not render text.');
      }
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [source, text, signature, gesturing, retry, layer?.key]);

  useEffect(() => { onChange(source ? layout : null, ready); }, [layout, source, ready, onChange]);

  function rebase(width = false) {
    gesture.current = { layout: current.current, points: [...points.current.values()], width };
  }
  function point(event: PointerEvent): Point {
    const rect = frame.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !layer || !source || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (!points.current.size && !target.closest('[data-text-box]')) return;
    if (points.current.size >= 2) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    points.current.set(event.pointerId, point(event));
    setGesturing(true);
    rebase(Boolean(target.closest('[data-width-handle]')) && points.current.size === 1);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!points.current.has(event.pointerId) || !gesture.current || !source) return;
    event.preventDefault();
    points.current.set(event.pointerId, point(event));
    const now = [...points.current.values()];
    const start = gesture.current;
    if (now.length === 2 && start.points.length === 2) {
      // Distances are measured in image pixels so portrait and landscape behave identically.
      const distance = (p: Point[]) => Math.hypot((p[0].x - p[1].x) * source.width, (p[0].y - p[1].y) * source.height);
      const before = center(start.points);
      const after = center(now);
      const scaled = scaleLayout(start.layout, distance(now) / Math.max(1, distance(start.points)), before);
      update({ ...scaled, box: { ...scaled.box, x: scaled.box.x + after.x - before.x, y: scaled.box.y + after.y - before.y } });
    } else if (start.width) {
      update({ ...start.layout, box: { ...start.layout.box,
        width: clamp(start.layout.box.width + now[0].x - start.points[0].x, 0.15, 0.98 - start.layout.box.x) } });
    } else {
      update({ ...start.layout, box: { ...start.layout.box,
        x: start.layout.box.x + now[0].x - start.points[0].x,
        y: start.layout.box.y + now[0].y - start.points[0].y } });
    }
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (!points.current.delete(event.pointerId)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (points.current.size) rebase();
    else { gesture.current = null; setGesturing(false); }
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const step = event.shiftKey ? 0.03 : 0.005;
    const { box } = layout;
    const directions: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    if (directions[event.key]) {
      event.preventDefault(); update({ ...layout, box: { ...box, x: box.x + directions[event.key].x, y: box.y + directions[event.key].y } });
    } else if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault(); update(scaleLayout(layout, event.key === '-' ? 0.95 : 1.05, { x: box.x + box.width / 2, y: box.y + box.height / 2 }));
    }
  }

  return (
    <section className='grid min-w-0 gap-3' aria-label='Text layout editor'>
      <h3 className='font-semibold'>Position your text</h3>
      <p id={`${id}-help`} className='text-sm text-gray-600'>Drag the text to move it. Pinch with two fingers to resize it, or drag the right handle to change line wrapping. You can scroll outside the photo.</p>
      {source ? (
        <div ref={frame} className='relative mx-auto w-full max-w-xl select-none overflow-hidden rounded-md bg-gray-200'
          style={{ aspectRatio: `${source.width} / ${source.height}`, touchAction: 'none' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
          {/* The server normalizes photo orientation; this preview is never uploaded to Google. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={source.url} alt='Photo for positioning diary text' className='pointer-events-none absolute inset-0 h-full w-full' draggable={false} onLoad={() => setSourceLoaded(true)} />
          {layer && (
            <div data-text-box role='button' tabIndex={disabled ? -1 : 0} aria-label='Move and resize diary text' aria-describedby={`${id}-help`} aria-disabled={disabled}
              onKeyDown={keyboard}
              className='absolute cursor-move outline outline-2 outline-blue-500 focus-visible:outline-4'
              style={{ left: `${layout.box.x * 100}%`, top: `${layout.box.y * 100}%`, width: `${layout.box.width * 100}%`, height: `${layout.box.height * 100}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={layer.url} alt='' className='pointer-events-none h-full w-full' draggable={false} onLoad={() => setLayerLoaded(layer.url)} />
              <span data-width-handle aria-hidden='true' className='absolute -right-3 top-1/2 flex h-12 w-6 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded bg-blue-600 text-white'>↔</span>
            </div>
          )}
        </div>
      ) : <p role='status'>Opening photo…</p>}
      {error ? <div role='alert' className='text-sm text-red-700'>{error} <Button type='button' variant='outline' onClick={() => { setError(''); setLayer(null); setRetry(n => n + 1); }}>Retry</Button></div>
        : <p role='status' className='text-sm text-gray-600'>{ready ? 'Layout ready. The blue outline and handle will not be saved.' : gesturing ? 'Adjusting text…' : 'Updating text preview…'}</p>}
      <fieldset disabled={disabled || !source || gesturing} className='grid min-w-0 gap-3'>
        <div className='flex flex-wrap gap-2'>
          {(['Top', 'Middle', 'Bottom'] as const).map((position) => <Button key={position} type='button' variant='outline' onClick={() => update({ ...layout, box: { ...layout.box, x: (1 - layout.box.width) / 2, y: position === 'Top' ? 0.05 : position === 'Middle' ? (1 - layout.box.height) / 2 : 0.95 - layout.box.height } })}>{position}</Button>)}
          <Button type='button' variant='outline' onClick={() => update({ ...DEFAULT_LAYOUT, box: { ...DEFAULT_LAYOUT.box } })}>Reset layout</Button>
        </div>
        <label className='grid gap-1 text-sm'>Text size
          <input aria-label='Text size' type='range' min={0.008} max={0.16} step={0.001} value={layout.fontSize} onChange={event => update({ ...layout, fontSize: Number(event.target.value) })} />
        </label>
        <label className='grid gap-1 text-sm'>Textbox width
          <input aria-label='Textbox width' type='range' min={0.15} max={0.96} step={0.01} value={layout.box.width} onChange={event => update({ ...layout, box: { ...layout.box, width: Number(event.target.value) } })} />
        </label>
        <details>
          <summary className='cursor-pointer py-2 text-sm font-medium'>Text style and precise position</summary>
          <div className='grid gap-3 pt-2'>
            <label className='grid gap-1 text-sm'>Font
              <select className='h-10 rounded border px-2' value={layout.fontFamily} onChange={event => update({ ...layout, fontFamily: event.target.value as TextLayout['fontFamily'] })}>
                <option value='sans'>Sans</option><option value='serif'>Serif</option><option value='rounded'>Rounded</option><option value='mono'>Monospace</option>
              </select>
            </label>
            <label className='flex items-center justify-between text-sm'>Text color<input type='color' value={layout.color} onChange={event => update({ ...layout, color: event.target.value })} /></label>
            <label className='grid gap-1 text-sm'>Outline width<input type='range' min={0} max={0.012} step={0.0005} value={layout.strokeWidth} onChange={event => update({ ...layout, strokeWidth: Number(event.target.value) })} /></label>
            <label className='flex items-center justify-between text-sm'>Outline color<input type='color' value={layout.strokeColor} disabled={layout.strokeWidth === 0} onChange={event => update({ ...layout, strokeColor: event.target.value })} /></label>
            <label className='grid gap-1 text-sm'>Horizontal position<input type='range' min={0.02} max={Math.max(0.02, 0.98 - layout.box.width)} step={0.001} value={layout.box.x} onChange={event => update({ ...layout, box: { ...layout.box, x: Number(event.target.value) } })} /></label>
            <label className='grid gap-1 text-sm'>Vertical position<input type='range' min={0.02} max={Math.max(0.02, 0.98 - layout.box.height)} step={0.001} value={layout.box.y} onChange={event => update({ ...layout, box: { ...layout.box, y: Number(event.target.value) } })} /></label>
            <p className='text-sm text-gray-600'>Keyboard: focus the text, use arrow keys to move it, and + or − to resize it. Hold Shift for larger moves.</p>
          </div>
        </details>
      </fieldset>
    </section>
  );
}
