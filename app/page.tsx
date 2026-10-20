'use client';

import { useCallback, useMemo, useState } from 'react';
import { SubjectDiaries } from '@/components/subject-diaries';
import { localDiaryDate, isDiaryDate } from '@/lib/diary-date';
import type { DiarySubject } from '@/lib/subjects';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { TextLayoutEditor } from '@/components/text-layout-editor';
import type { TextLayout } from '@/lib/text-layout';
import { diaryOverlayText } from '@/lib/diary-overlay-text';

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
  const [saveState, setSaveState] = useState<
    | { kind: 'idle' }
    | { kind: 'saving'; message: string }
    | { kind: 'success'; message: string; warnings: string[] }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const saving = saveState.kind === 'saving';
  const overlayText = useMemo(
    () => isDiaryDate(diaryDate) ? diaryOverlayText(diaryDate, diaryText) : '',
    [diaryDate, diaryText],
  );

  const [layoutText, setLayoutText] = useState('');
  const onLayoutChange = useCallback(
    (next: TextLayout | null, ready: boolean) => {
      setLayoutText(overlayText);
      setLayout(next);
      setLayoutReady(ready);
    },
    [overlayText],
  );

  async function saveDiary() {
    if (
      !photo ||
      !diaryText.trim() ||
      !layout ||
      !layoutReady ||
      layoutText !== overlayText
    ) {
      setSaveState({ kind: 'error', message: 'Add a photo and diary line, then wait for the text layout to finish updating.' });
      return;
    }

    if (!isDiaryDate(diaryDate)) {
      setSaveState({ kind: 'error', message: 'Please choose a valid diary date.' });
      return;
    }

    setSaveState({ kind: 'saving', message: `Creating your diary image and saving it to ${albumTitle}…` });
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
        setSaveState({ kind: 'error', message: payload.error ?? 'Save failed. Your draft is still here.' });
        return;
      }

      setSaveState({
        kind: 'success',
        message: `Saved ${subjectName}'s diary entry to ${albumTitle}.`,
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
      });
    } catch {
      setSaveState({ kind: 'error', message: 'The save could not be confirmed. Check the album before retrying; your draft is still here.' });
    }
  }

  return (
    <div className='grid gap-5'>
      <div className='rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-violet-50 p-5 text-slate-900 shadow-lg shadow-cyan-100/50'>
        <p className='mb-1 text-sm font-bold uppercase tracking-wider text-cyan-700'>Step 2</p>
        <h2 className='text-2xl font-bold'>
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
        disabled={saving}
        className='grid min-w-0 gap-3 rounded-3xl border border-white/80 bg-white/85 p-5 shadow-lg shadow-violet-100/50 backdrop-blur sm:p-7'
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
          onChange={(event) => {
            setDiaryDate(event.target.value);
            setLayoutReady(false);
            setSaveState({ kind: 'idle' });
          }}
        />
        <p className='text-sm text-slate-600'>
          The day this memory happened, even if you are saving it later.
        </p>
        <label htmlFor={`${subject.id}-photo`} className='text-sm font-medium'>
          Photo
        </label>
        <Input
          id={`${subject.id}-photo`}
          type='file'
          accept='image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/tiff,image/gif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.tif,.tiff,.gif'
          onChange={(event) => {
            setPhoto(event.target.files?.[0] ?? null);
            setPhotoVersion((v) => v + 1);
            setLayout(null);
            setLayoutReady(false);
            setSaveState({ kind: 'idle' });
          }}
        />
        <p className='text-sm text-slate-600'>
          JPEG, PNG, WebP, AVIF, HEIC/HEIF, TIFF, and GIF are supported. For a
          Live or Motion Photo, the still image is used for the diary; the full
          original is kept when original-photo saving is enabled.
        </p>

        <label htmlFor={`${subject.id}-diary`} className='text-sm font-medium'>
          Diary line
        </label>
        <Textarea
          id={`${subject.id}-diary`}
          value={diaryText}
          onChange={(event) => {
            setDiaryText(event.target.value);
            setLayoutReady(false);
            setSaveState({ kind: 'idle' });
          }}
          maxLength={80}
          placeholder='For example: We built blocks together and laughed all afternoon.'
        />

        {photo && diaryText.trim() && (
          <TextLayoutEditor
            key={photoVersion}
            photo={photo}
            text={overlayText}
            disabled={saving}
            onChange={onLayoutChange}
          />
        )}
        <div className='grid gap-2'>
          <Button
            type='button'
            onClick={saveDiary}
            disabled={saving || !layoutReady || layoutText !== overlayText}
            className='min-h-12 w-full text-base font-bold shadow-lg shadow-violet-200 sm:w-auto sm:px-8'
          >
            {saving ? 'Saving your diary…' : 'Save to Google Photos'}
          </Button>
          <p className='text-xs text-slate-500'>The positioned image above is what will be saved.</p>
        </div>
      </fieldset>

      {saveState.kind !== 'idle' ? (
        <SaveStatusModal state={saveState} onClose={() => setSaveState({ kind: 'idle' })} />
      ) : null}
    </div>
  );
}

function SaveStatusModal({ state, onClose }: {
  state:
    | { kind: 'saving'; message: string }
    | { kind: 'success'; message: string; warnings: string[] }
    | { kind: 'error'; message: string };
  onClose: () => void;
}) {
  const saving = state.kind === 'saving';
  const success = state.kind === 'success';

  return (
    <div className='fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm' role='presentation'>
      <div
        role='dialog'
        aria-modal='true'
        aria-live='assertive'
        aria-label={saving ? 'Saving diary' : success ? 'Diary saved' : 'Save failed'}
        className={`w-full max-w-md rounded-3xl border p-7 text-center shadow-2xl ${success ? 'border-emerald-200 bg-emerald-50' : state.kind === 'error' ? 'border-rose-200 bg-rose-50' : 'border-violet-200 bg-white'}`}
      >
        {saving ? (
          <>
            <div className='mx-auto h-14 w-14 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600' aria-hidden='true' />
            <h2 className='mt-5 text-2xl font-black text-violet-950'>Saving your diary</h2>
            <p className='mt-2 text-sm text-slate-600'>{state.message}</p>
            <div className='mt-6 h-2 overflow-hidden rounded-full bg-violet-100' role='progressbar' aria-label='Diary save in progress'>
              <div className='h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500' />
            </div>
            <p className='mt-3 text-xs text-slate-500'>Keep this page open until the save finishes.</p>
          </>
        ) : success ? (
          <>
            <div className='mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-4xl font-black text-white shadow-lg shadow-emerald-200' aria-hidden='true'>✓</div>
            <h2 className='mt-5 text-2xl font-black text-emerald-950'>Diary saved</h2>
            <p className='mt-2 text-sm text-emerald-900'>{state.message}</p>
            {state.warnings.length > 0 ? (
              <ul className='mt-4 space-y-2 rounded-2xl bg-amber-50 p-4 text-left text-xs text-amber-950'>
                {state.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
              </ul>
            ) : null}
            <Button type='button' onClick={onClose} className='mt-6 min-h-11 w-full bg-emerald-600 hover:bg-emerald-700'>Done</Button>
          </>
        ) : (
          <>
            <div className='mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-500 text-3xl font-black text-white shadow-lg shadow-rose-200' aria-hidden='true'>!</div>
            <h2 className='mt-5 text-2xl font-black text-rose-950'>Could not save</h2>
            <p className='mt-2 text-sm text-rose-900'>{state.message}</p>
            <Button type='button' variant='outline' onClick={onClose} className='mt-6 min-h-11 w-full'>Return to your draft</Button>
          </>
        )}
      </div>
    </div>
  );
}
