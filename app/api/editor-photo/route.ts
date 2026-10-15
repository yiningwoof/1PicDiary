import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { orientedPhoto, PhotoInputError } from '@/lib/image';
export const runtime = 'nodejs';

function fileDetails(file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
  return { fileName: file.name, extension: extension ? `.${extension}` : 'none', reportedMimeType: file.type || 'not provided' };
}

export async function POST(request: Request) {
  let uploadedFile: File | null = null;
  try {
    const file = (await request.formData()).get('photo');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a photo to inspect and edit.' }, { status: 400 });
    }
    uploadedFile = file;
    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({
        error: 'The file is over the 30 MB upload limit.',
        details: { ...fileDetails(file), detectedFormat: 'Not inspected', reason: 'file-too-large' },
      }, { status: 400 });
    }
    const { data, info, sourceFormat, outputFormat, decoder } = await orientedPhoto(Buffer.from(await file.arrayBuffer()));
    if (info.width < 32 || info.height < 32 || info.width > 16000 || info.height > 16000) {
      return NextResponse.json({
        error: `The ${sourceFormat} photo is ${info.width}×${info.height}. Each side must be between 32 and 16,000 pixels.`,
        details: { ...fileDetails(file), detectedFormat: sourceFormat, reason: 'invalid-dimensions' },
      }, { status: 400 });
    }
    const preview = await sharp(data).resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    return NextResponse.json({
      width: info.width,
      height: info.height,
      url: `data:image/jpeg;base64,${preview.toString('base64')}`,
      conversion: { ...fileDetails(file), detectedFormat: sourceFormat, editingFormat: outputFormat, decoder },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof PhotoInputError
        ? error.message
        : 'This photo could not be opened. It may be damaged or use an unsupported camera format.',
      details: {
        ...(uploadedFile ? fileDetails(uploadedFile) : {}),
        detectedFormat: error instanceof PhotoInputError ? error.detectedFormat : 'Unknown',
        reason: error instanceof PhotoInputError ? error.reason : 'unexpected-processing-error',
      },
    }, { status: 400 });
  }
}
