import { NextResponse } from 'next/server';
import { renderTextLayer } from '@/lib/image';
import { parseTextLayout } from '@/lib/text-layout';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const { text, width, height, layout: raw } = await request.json();
    if (typeof text !== 'string' || !text.trim() || text.length > 1000 ||
      !Number.isInteger(width) || !Number.isInteger(height) || width < 32 || height < 32 ||
      width > 16000 || height > 16000 || width * height > 60_000_000) {
      return NextResponse.json({ error: 'Invalid image dimensions or text.' }, { status: 400 });
    }
    const layout = parseTextLayout(raw);
    if (!layout) throw new Error('Text layout is required.');
    const layer = await renderTextLayer(text, width, height, layout);
    return NextResponse.json({ url: `data:image/png;base64,${layer.png.toString('base64')}`, layout: layer.textLayout }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not render text.' }, { status: 400 });
  }
}
