'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { SubjectDiaries } from '@/components/subject-diaries';
import { localDiaryDate, isDiaryDate } from '@/lib/diary-date';
import type { DiarySubject } from '@/lib/subjects';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { TextLayoutEditor } from '@/components/text-layout-editor';
import type { TextLayout } from '@/lib/text-layout';

export default function Home() {
  return (
    <SubjectDiaries>
      {(subject) => <DiaryEditor subject={subject} />}
    </SubjectDiaries>
  );
}

function DiaryEditor({ subject }: { subject: DiarySubject }) {
  const subjectName = subject.name;
  const albumTitle = subject.diary_album_title;
  const [diaryDate, setDiaryDate] = useState(() => localDiaryDate());
  const [diaryText, setDiaryText] = useState('');
  const [layout, setLayout] = useState<TextLayout | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const [layoutText, setLayoutText] = useState('');
  const onLayoutChange = useCallback(
    (next: TextLayout | null, ready: boolean) => {
      setLayoutText(diaryText);
      setLayout(next);
      setLayoutReady(ready);
      setPreviewUrl(null);
    },
    [diaryText],
  );

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  async function generatePreview() {
    if (
      !photo ||
      !diaryText.trim() ||
      !layout ||
      !layoutReady ||
      layoutText !== diaryText
    ) {
      setStatus(
        'Add a photo and diary line, then wait for the text layout to finish updating.',
      );
      return;
    }

    setPreviewing(true);
    setStatus('Generating preview...');
    try {
      const formData = new FormData();
      formData.set('photo', photo);
      formData.set('subjectName', subjectName);
      formData.set('diaryText', diaryText);
      formData.set('textLayout', JSON.stringify(layout));
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
    } catch {
      setStatus(
        'Preview could not be generated. Your draft is still here; please retry.',
      );
    } finally {
      setPreviewing(false);
    }
  }

  async function saveDiary() {
    if (
      !photo ||
      !diaryText.trim() ||
      !layout ||
      !layoutReady ||
      layoutText !== diaryText
    ) {
      setStatus(
        'Add a photo and diary line, then wait for the text layout to finish updating.',
      );
      return;
    }

    if (!isDiaryDate(diaryDate)) {
      setStatus('Please choose a valid diary date.');
      return;
    }

    setSaving(true);
    setStatus(`Saving to ${albumTitle}...`);
    try {
      const formData = new FormData();
      formData.set('photo', photo);
      formData.set('subjectName', subjectName);
      formData.set('diaryText', diaryText);
      formData.set('textLayout', JSON.stringify(layout));
      formData.set('subjectId', subject.id);
      formData.set('diaryDate', diaryDate);

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
        `Saved diary entry for ${subjectName} to ${albumTitle}.${warnings}`,
      );
    } catch {
      setStatus(
        'The save could not be confirmed. Check the album before retrying; your draft is still here.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='grid gap-4'>
      <div className='rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950'>
        <h2 className='text-lg font-semibold'>
          2. Create a diary entry for {subjectName}
        </h2>
        <p className='mt-1 break-words text-sm'>
          Saving to: <strong>{albumTitle}</strong>
        </p>
        {subject.save_originals && (
          <p className='mt-1 break-words text-sm'>
            Original photos: <strong>{subject.originals_album_title}</strong>
          </p>
        )}
      </div>
      <fieldset
        disabled={saving || previewing}
        className='grid min-w-0 gap-3 rounded-lg border border-gray-200 p-4'
      >
        <label htmlFor={`${subject.id}-date`} className='text-sm font-medium'>
          Diary date
        </label>
        <Input
          id={`${subject.id}-date`}
          type='date'
          required
          min='0001-01-01'
          max='9999-12-31'
          value={diaryDate}
          onChange={(event) => setDiaryDate(event.target.value)}
        />
        <p className='text-sm text-gray-600'>
          The day this memory happened, even if you are saving it later.
        </p>
        <label htmlFor={`${subject.id}-photo`} className='text-sm font-medium'>
          Photo
        </label>
        <Input
          id={`${subject.id}-photo`}
          type='file'
          accept='image/*'
          onChange={(event) => {
            setPhoto(event.target.files?.[0] ?? null);
            setPhotoVersion((v) => v + 1);
            setLayout(null);
            setLayoutReady(false);
            setPreviewUrl(null);
          }}
        />

        <label htmlFor={`${subject.id}-diary`} className='text-sm font-medium'>
          Diary line
        </label>
        <Textarea
          id={`${subject.id}-diary`}
          value={diaryText}
          onChange={(event) => {
            setDiaryText(event.target.value);
            setLayoutReady(false);
            setPreviewUrl(null);
          }}
          maxLength={80}
          placeholder='例如：今天和妹妹一起搭积木，笑得很开心。'
        />

        {photo && diaryText.trim() && (
          <TextLayoutEditor
            key={photoVersion}
            photo={photo}
            text={`${subjectName}: ${diaryText.trim()}`}
            disabled={saving || previewing}
            onChange={onLayoutChange}
          />
        )}
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={generatePreview}
            disabled={!layoutReady || layoutText !== diaryText}
          >
            {previewing ? 'Generating preview…' : 'Preview composed image'}
          </Button>
          <Button
            type='button'
            onClick={saveDiary}
            disabled={saving || !layoutReady || layoutText !== diaryText}
          >
            {saving ? 'Saving...' : 'Save to Google Photos'}
          </Button>
        </div>
      </fieldset>

      <div className='grid gap-3 rounded-lg border border-gray-200 p-4'>
        <h2 className='text-sm font-medium'>Preview</h2>
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt='合成图预览'
            width={800}
            height={800}
            unoptimized
            className='max-h-96 w-auto rounded-md object-contain'
          />
        ) : (
          <p className='text-sm text-gray-500'>尚未生成合成预览</p>
        )}
      </div>

      {status ? (
        <p role='status' className='text-sm text-gray-700'>
          {status}
        </p>
      ) : null}
    </div>
  );
}
