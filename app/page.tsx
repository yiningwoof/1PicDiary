'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SubjectDiaries } from '@/components/subject-diaries';
import { localDiaryDate, isDiaryDate } from '@/lib/diary-date';
import type { DiarySubject } from '@/lib/subjects';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { TextLayoutEditor } from '@/components/text-layout-editor';
import type { TextLayout } from '@/lib/text-layout';
import { diaryOverlayText } from '@/lib/diary-overlay-text';
import { exceedsGooglePhotosPhotoLimit, googlePhotosPhotoLimitMessage } from '@/lib/upload-limits';

type DiaryDraft = {
  diaryText: string;
  diaryDate: string;
  updatedAt: string;
};

type SavedEntryReminder = {
  diaryText: string;
  diaryDate: string;
  savedAt: string;
};

const draftKey = (subjectId: string) => `1picdiary:draft:v1:${subjectId}`;
const lastSavedKey = (subjectId: string) => `1picdiary:last-saved:v1:${subjectId}`;

function readStoredEntry<T extends DiaryDraft | SavedEntryReminder>(key: string, timeField: 'updatedAt' | 'savedAt'): T | null {
  try {
    const entry = JSON.parse(window.localStorage.getItem(key) ?? 'null') as Record<string, unknown> | null;
    if (!entry || typeof entry.diaryText !== 'string' || !entry.diaryText.trim() || typeof entry.diaryDate !== 'string' || !isDiaryDate(entry.diaryDate) || typeof entry[timeField] !== 'string') return null;
    return entry as T;
  } catch {
    return null;
  }
}

function friendlyDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return `${month}/${day}/${year}`;
}

function friendlyTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

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
  const [recoveryDraft, setRecoveryDraft] = useState<DiaryDraft | null>(null);
  const [lastSaved, setLastSaved] = useState<SavedEntryReminder | null>(null);
  const [draftNotice, setDraftNotice] = useState('');
  const [layout, setLayout] = useState<TextLayout | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saveState, setSaveState] = useState<
    | { kind: 'idle' }
    | { kind: 'saving'; message: string }
    | { kind: 'success'; message: string; warnings: string[] }
    | { kind: 'error'; message: string; reconnectRequired?: boolean }
    | { kind: 'reconnecting'; message: string }
  >({ kind: 'idle' });
  const saving = saveState.kind === 'saving' || saveState.kind === 'reconnecting';
  const overlayText = useMemo(
    () => isDiaryDate(diaryDate) ? diaryOverlayText(diaryDate, diaryText) : '',
    [diaryDate, diaryText],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecoveryDraft(readStoredEntry<DiaryDraft>(draftKey(subject.id), 'updatedAt'));
      setLastSaved(readStoredEntry<SavedEntryReminder>(lastSavedKey(subject.id), 'savedAt'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [subject.id]);

  function storeDraft(nextText: string, nextDate: string) {
    try {
      if (!nextText.trim() || !isDiaryDate(nextDate)) {
        window.localStorage.removeItem(draftKey(subject.id));
        return;
      }
      window.localStorage.setItem(draftKey(subject.id), JSON.stringify({
        diaryText: nextText,
        diaryDate: nextDate,
        updatedAt: new Date().toISOString(),
      } satisfies DiaryDraft));
      setDraftNotice('Draft saved on this device.');
    } catch {
      setDraftNotice('This browser could not save the draft locally.');
    }
  }

  function applyEntry(entry: Pick<DiaryDraft, 'diaryText' | 'diaryDate'>) {
    setDiaryText(entry.diaryText);
    setDiaryDate(entry.diaryDate);
    setLayoutReady(false);
    setSaveState({ kind: 'idle' });
    storeDraft(entry.diaryText, entry.diaryDate);
    setRecoveryDraft(null);
  }

  function discardDraft() {
    try { window.localStorage.removeItem(draftKey(subject.id)); } catch { /* The in-memory draft can still be dismissed. */ }
    setRecoveryDraft(null);
    setDraftNotice('');
  }

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
        setSaveState({
          kind: 'error',
          message: payload.error ?? 'Save failed. Your draft is still here.',
          reconnectRequired: Boolean(payload.reconnectRequired),
        });
        return;
      }

      const savedEntry: SavedEntryReminder = {
        diaryText,
        diaryDate,
        savedAt: new Date().toISOString(),
      };
      try {
        window.localStorage.removeItem(draftKey(subject.id));
        window.localStorage.setItem(lastSavedKey(subject.id), JSON.stringify(savedEntry));
      } catch { /* A successful Google Photos save does not depend on browser storage. */ }
      setRecoveryDraft(null);
      setLastSaved(savedEntry);
      setDraftNotice('');

      setSaveState({
        kind: 'success',
        message: `Saved ${subjectName}'s diary entry to ${albumTitle}.`,
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
      });
    } catch {
      setSaveState({ kind: 'error', message: 'The save could not be confirmed. Check the album before retrying; your draft is still here.' });
    }
  }

  function reconnectAndResume() {
    const popup = window.open(
      '/api/auth/google/start?mode=popup',
      'google-photos-reconnect',
      'popup=yes,width=560,height=720',
    );
    if (!popup) {
      setSaveState({ kind: 'error', message: 'Allow pop-ups for this site, then reconnect again.', reconnectRequired: true });
      return;
    }

    setSaveState({ kind: 'reconnecting', message: 'Finish reconnecting in the Google window. Your draft stays on this page.' });
    let finished = false;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedCheck);
      window.clearTimeout(timeout);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'google-oauth-complete') return;
      finished = true;
      cleanup();
      if (event.data.success) {
        void saveDiary();
      } else {
        setSaveState({ kind: 'error', message: 'Google Photos was not reconnected. Your draft is still here.', reconnectRequired: true });
      }
    };
    window.addEventListener('message', onMessage);
    const closedCheck = window.setInterval(() => {
      if (!finished && popup.closed) {
        cleanup();
        setSaveState({ kind: 'error', message: 'The Google connection window was closed. Your draft is still here.', reconnectRequired: true });
      }
    }, 500);
    const timeout = window.setTimeout(() => {
      if (!finished) {
        cleanup();
        popup.close();
        setSaveState({ kind: 'error', message: 'Google Photos reconnection timed out. Your draft is still here.', reconnectRequired: true });
      }
    }, 5 * 60 * 1000);
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
      {recoveryDraft ? (
        <div className='rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-md shadow-amber-100/60' role='status'>
          <p className='text-sm font-bold uppercase tracking-wider text-amber-700'>Unfinished draft found</p>
          <p className='mt-2 font-semibold text-slate-900'>{friendlyDate(recoveryDraft.diaryDate)} · “{recoveryDraft.diaryText}”</p>
          <p className='mt-1 text-xs text-slate-600'>Saved on this device {friendlyTime(recoveryDraft.updatedAt)}</p>
          <div className='mt-4 flex flex-wrap gap-2'>
            <Button type='button' onClick={() => applyEntry(recoveryDraft)}>Restore draft</Button>
            <Button type='button' variant='outline' onClick={discardDraft}>Discard</Button>
          </div>
        </div>
      ) : lastSaved ? (
        <div className='rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5'>
          <p className='text-sm font-bold uppercase tracking-wider text-emerald-700'>Last saved entry</p>
          <p className='mt-2 text-sm text-slate-800'>{friendlyDate(lastSaved.diaryDate)} · “{lastSaved.diaryText}”</p>
          <p className='mt-1 text-xs text-slate-600'>Saved {friendlyTime(lastSaved.savedAt)}</p>
          <Button type='button' variant='outline' className='mt-3' onClick={() => applyEntry(lastSaved)}>Use text and date again</Button>
        </div>
      ) : null}
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
            const nextDate = event.target.value;
            setDiaryDate(nextDate);
            if (diaryText.trim()) {
              setRecoveryDraft(null);
              storeDraft(diaryText, nextDate);
            }
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
            const nextPhoto = event.target.files?.[0] ?? null;
            if (nextPhoto && exceedsGooglePhotosPhotoLimit(nextPhoto.size)) {
              event.target.value = '';
              setPhoto(null);
              setSaveState({ kind: 'error', message: googlePhotosPhotoLimitMessage });
              return;
            }
            setPhoto(nextPhoto);
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
            const nextText = event.target.value;
            setDiaryText(nextText);
            setRecoveryDraft(null);
            storeDraft(nextText, diaryDate);
            setLayoutReady(false);
            setSaveState({ kind: 'idle' });
          }}
          placeholder='For example: We built blocks together and laughed all afternoon.'
        />
        {draftNotice ? <p role='status' className='text-xs font-medium text-violet-700'>{draftNotice}</p> : null}

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
        <SaveStatusModal state={saveState} onClose={() => setSaveState({ kind: 'idle' })} onReconnect={reconnectAndResume} />
      ) : null}
    </div>
  );
}

function SaveStatusModal({ state, onClose, onReconnect }: {
  state:
    | { kind: 'saving'; message: string }
    | { kind: 'success'; message: string; warnings: string[] }
    | { kind: 'error'; message: string; reconnectRequired?: boolean }
    | { kind: 'reconnecting'; message: string };
  onClose: () => void;
  onReconnect: () => void;
}) {
  const saving = state.kind === 'saving' || state.kind === 'reconnecting';
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
            <h2 className='mt-5 text-2xl font-black text-violet-950'>{state.kind === 'reconnecting' ? 'Reconnect Google Photos' : 'Saving your diary'}</h2>
            <p className='mt-2 text-sm text-slate-600'>{state.message}</p>
            <div className='mt-6 h-2 overflow-hidden rounded-full bg-violet-100' role='progressbar' aria-label='Diary save in progress'>
              <div className='h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500' />
            </div>
            <p className='mt-3 text-xs text-slate-500'>{state.kind === 'reconnecting' ? 'Your photo, diary text, and layout are being kept here.' : 'Keep this page open until the save finishes.'}</p>
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
            {state.reconnectRequired ? (
              <Button type='button' onClick={onReconnect} className='mt-6 min-h-11 w-full'>Reconnect and continue saving</Button>
            ) : null}
            <Button type='button' variant='outline' onClick={onClose} className={`${state.reconnectRequired ? 'mt-3' : 'mt-6'} min-h-11 w-full`}>Return to your draft</Button>
          </>
        )}
      </div>
    </div>
  );
}
