'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const DEFAULT_CHILDREN = ['Child 1', 'Child 2'];
type TextPosition = 'top' | 'middle' | 'bottom';
type FontFamilyKey = 'sans' | 'serif' | 'rounded' | 'mono';

const FONT_OPTIONS: { value: FontFamilyKey; label: string }[] = [
  { value: 'sans', label: 'Sans (default)' },
  { value: 'serif', label: 'Serif' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'mono', label: 'Monospace' },
];

export default function Home() {
  const [childName, setChildName] = useState(DEFAULT_CHILDREN[0]);
  const [diaryText, setDiaryText] = useState('');
  const [albumTitle, setAlbumTitle] = useState('1PicDiary');
  const [textPosition, setTextPosition] = useState<TextPosition>('bottom');
  const [fontFamily, setFontFamily] = useState<FontFamilyKey>('sans');
  const [fontScale, setFontScale] = useState(1);
  const [textColor, setTextColor] = useState('#ffffff');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const sourcePreviewUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );

  useEffect(() => {
    return () => {
      if (sourcePreviewUrl) {
        URL.revokeObjectURL(sourcePreviewUrl);
      }
    };
  }, [sourcePreviewUrl]);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  async function generatePreview() {
    if (!photo || !diaryText.trim()) {
      setStatus('Please upload a photo and write one diary line first.');
      return;
    }

    setStatus('Generating preview...');
    const formData = new FormData();
    formData.set('photo', photo);
    formData.set('childName', childName);
    formData.set('diaryText', diaryText);
    formData.set('textPosition', textPosition);
    formData.set('fontFamily', fontFamily);
    formData.set('fontScale', String(fontScale));
    formData.set('textColor', textColor);
    formData.set('strokeColor', strokeColor);
    formData.set('strokeWidth', String(strokeWidth));
    const response = await fetch('/api/compose', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setStatus(payload.error ?? 'Preview failed');
      return;
    }

    const blob = await response.blob();
    const nextPreviewUrl = URL.createObjectURL(blob);
    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return nextPreviewUrl;
    });
    setStatus('Preview ready. You can now save it to Google Photos.');
  }

  async function saveDiary() {
    if (!photo || !diaryText.trim()) {
      setStatus('Please upload a photo and write one diary line first.');
      return;
    }

    setSaving(true);
    setStatus('Saving to Google Photos...');

    const formData = new FormData();
    formData.set('photo', photo);
    formData.set('childName', childName);
    formData.set('diaryText', diaryText);
    formData.set('textPosition', textPosition);
    formData.set('fontFamily', fontFamily);
    formData.set('fontScale', String(fontScale));
    formData.set('textColor', textColor);
    formData.set('strokeColor', strokeColor);
    formData.set('strokeWidth', String(strokeWidth));
    formData.set('albumTitle', albumTitle);

    const response = await fetch('/api/save-diary', {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus(payload.error ?? 'Save failed');
      setSaving(false);
      return;
    }

    const warnings = payload.warnings?.length
      ? ` (warnings: ${payload.warnings.join('; ')})`
      : '';
    setStatus(
      `Saved successfully. MediaItemId: ${payload.mediaItemId ?? 'N/A'}${warnings}`,
    );
    setSaving(false);
  }

  return (
    <main className='mx-auto flex w-full max-w-3xl flex-col gap-4 p-6'>
      <h1 className='text-2xl font-bold'>1PicDiary</h1>
      <p className='text-sm text-gray-600'>
        Pick a child, upload one photo, write one diary line, adjust the text
        style, then preview and save it to your Google Photos app album.
      </p>

      <div className='grid gap-3 rounded-lg border border-gray-200 p-4'>
        <label className='text-sm font-medium'>Google connection</label>
        <Link
          className='text-sm text-blue-600 underline'
          href='/connect-google-photos'
        >
          Set up Google Photos
        </Link>
        <p className='text-sm text-gray-600'>
          Connect your account and learn where your diary photos will be saved.
        </p>
      </div>

      <div className='grid gap-3 rounded-lg border border-gray-200 p-4'>
        <label className='text-sm font-medium'>Child</label>
        <select
          className='h-9 rounded-md border border-gray-300 px-3'
          value={childName}
          onChange={(event) => setChildName(event.target.value)}
        >
          {DEFAULT_CHILDREN.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <label className='text-sm font-medium'>Photo</label>
        <Input
          type='file'
          accept='image/*'
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
        />

        <label className='text-sm font-medium'>Diary line</label>
        <Textarea
          value={diaryText}
          onChange={(event) => setDiaryText(event.target.value)}
          maxLength={80}
          placeholder='For example: Built blocks with my sister today and laughed a lot.'
        />

        <label className='text-sm font-medium'>Text position</label>
        <select
          className='h-9 rounded-md border border-gray-300 px-3'
          value={textPosition}
          onChange={(event) =>
            setTextPosition(event.target.value as TextPosition)
          }
        >
          <option value='top'>Top</option>
          <option value='middle'>Middle</option>
          <option value='bottom'>Bottom</option>
        </select>

        <label className='text-sm font-medium'>Font</label>
        <select
          className='h-9 rounded-md border border-gray-300 px-3'
          value={fontFamily}
          onChange={(event) =>
            setFontFamily(event.target.value as FontFamilyKey)
          }
        >
          {FONT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className='text-sm font-medium'>
          Text size ({fontScale.toFixed(1)}x)
        </label>
        <input
          type='range'
          min={0.6}
          max={2.5}
          step={0.1}
          value={fontScale}
          onChange={(event) => setFontScale(Number(event.target.value))}
        />

        <label className='text-sm font-medium'>Text color</label>
        <div className='flex items-center gap-3'>
          <input
            type='color'
            className='h-9 w-16 rounded-md border border-gray-300'
            value={textColor}
            onChange={(event) => setTextColor(event.target.value)}
          />
          <span className='text-sm text-gray-600'>{textColor}</span>
        </div>
        <label className='text-sm font-medium'>
          Outline width ({strokeWidth}px)
        </label>
        <input
          type='range'
          min={0}
          max={12}
          step={1}
          value={strokeWidth}
          onChange={(event) => setStrokeWidth(Number(event.target.value))}
        />

        <label className='text-sm font-medium'>Outline color</label>
        <div className='flex items-center gap-3'>
          <input
            type='color'
            className='h-9 w-16 rounded-md border border-gray-300'
            value={strokeColor}
            onChange={(event) => setStrokeColor(event.target.value)}
            disabled={strokeWidth === 0}
          />
          <span className='text-sm text-gray-600'>
            {strokeWidth === 0
              ? 'Set outline width above 0 to enable'
              : strokeColor}
          </span>
        </div>
        <label className='text-sm font-medium'>Google Photos album title</label>
        <p className='text-sm text-gray-600'>
          We create this album on your first save, then reuse it. Only albums
          created by 1PicDiary can be used, even if another album has the same name.
        </p>
        <Input
          value={albumTitle}
          onChange={(event) => setAlbumTitle(event.target.value)}
        />

        <div className='flex gap-2'>
          <Button type='button' variant='outline' onClick={generatePreview}>
            Preview composed image
          </Button>
          <Button type='button' onClick={saveDiary} disabled={saving}>
            {saving ? 'Saving...' : 'Save to Google Photos'}
          </Button>
        </div>
      </div>

      <div className='grid gap-3 rounded-lg border border-gray-200 p-4'>
        <h2 className='text-sm font-medium'>Preview</h2>
        {sourcePreviewUrl ? (
          <Image
            src={sourcePreviewUrl}
            alt='Original photo preview'
            width={800}
            height={800}
            unoptimized
            className='max-h-96 w-auto rounded-md object-contain'
          />
        ) : (
          <p className='text-sm text-gray-500'>No image selected yet</p>
        )}
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt='Composed image preview'
            width={800}
            height={800}
            unoptimized
            className='max-h-96 w-auto rounded-md object-contain'
          />
        ) : (
          <p className='text-sm text-gray-500'>
            No composed preview generated yet
          </p>
        )}
      </div>

      {status ? <p className='text-sm text-gray-700'>{status}</p> : null}
    </main>
  );
}
