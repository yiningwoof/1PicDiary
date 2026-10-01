import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { orientedPhoto } from '@/lib/image';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const file = (await request.formData()).get('photo');
    if (!(file instanceof File) || file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: 'Choose an image up to 30 MB.' }, { status: 400 });
    }
    const { data, info } = await orientedPhoto(Buffer.from(await file.arrayBuffer()));
    if (info.width < 32 || info.height < 32 || info.width > 16000 || info.height > 16000) {
      return NextResponse.json({ error: 'Choose a photo between 32 and 16,000 pixels on each side.' }, { status: 400 });
    }
    const preview = await sharp(data).resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    return NextResponse.json({ width: info.width, height: info.height, url: `data:image/jpeg;base64,${preview.toString('base64')}` }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'This photo could not be opened. Try a JPEG or PNG image.' }, { status: 400 });
  }
}
