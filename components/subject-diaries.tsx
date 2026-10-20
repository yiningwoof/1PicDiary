'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { albumNames } from '@/lib/album-names';
import type { DiarySubject } from '@/lib/subjects';

export function SubjectDiaries({ children: renderDiary }: { children: (subject: DiarySubject) => ReactNode }) {
  const [profiles, setProfiles] = useState<DiarySubject[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [ready, setReady] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [customAlbum, setCustomAlbum] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const [saveOriginals, setSaveOriginals] = useState(true);
  const [subjectToDelete, setSubjectToDelete] = useState<DiarySubject | null>(null);
  const [deletingId, setDeletingId] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [subjectNotice, setSubjectNotice] = useState('');
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const albumTitle = customAlbum ?? name.trim();
  const albums = albumNames(albumTitle);

  async function loadSubjects() {
    setLoading(true);
    setError('');
    setNeedsReconnect(false);
    setReady(false);
    try {
      const statusResponse = await fetch('/api/auth/google/status', { cache: 'no-store' });
      const statusResult = await statusResponse.json().catch(() => ({}));
      if (!statusResponse.ok) {
        setNeedsReconnect(Boolean(statusResult.reconnectRequired));
        throw new Error(statusResult.error ?? 'Unable to verify your Google Photos connection.');
      }

      const response = await fetch('/api/subjects', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to load your subjects.');
      setProfiles(result.subjects);
      setReady(true);
    } catch (error) {
      setProfiles([]);
      setSelected('');
      setError(error instanceof Error ? error.message : 'Unable to load your subjects. Please retry.');
    } finally { setLoading(false); }
  }

  // Loading subjects synchronizes this mounted view with the authenticated server.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadSubjects(); }, []);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (subjectToDelete && !dialog.open) dialog.showModal();
    if (!subjectToDelete && dialog.open) dialog.close();
  }, [subjectToDelete]);

  async function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdding(true);
    setAddError('');
    setSubjectNotice('');
    try {
      const response = await fetch('/api/subjects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), albumTitle: albumTitle.trim(), saveOriginals }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to add your subject.');
      setProfiles((current) => [...current, result.subject]);
      setSelected(result.subject.id);
      setName('');
      setCustomAlbum(null);
      setSaveOriginals(true);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Unable to add your subject. Please try again.');
    } finally { setAdding(false); }
  }

  async function deleteSubject() {
    if (!subjectToDelete) return;
    setDeletingId(subjectToDelete.id);
    setDeleteError('');
    setSubjectNotice('');
    try {
      const response = await fetch(`/api/subjects/${subjectToDelete.id}`, {
        method: 'DELETE',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Unable to delete this subject.');

      setProfiles((current) => current.filter((subject) => subject.id !== subjectToDelete.id));
      if (selected === subjectToDelete.id) setSelected('');
      setSubjectNotice(`${subjectToDelete.name} was removed from 1PicDiary. Their Google Photos albums and photos were kept.`);
      setSubjectToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete this subject. Please try again.');
    } finally {
      setDeletingId('');
    }
  }

  const subjectColors = [
    'border-rose-200 bg-rose-50 hover:border-rose-400',
    'border-violet-200 bg-violet-50 hover:border-violet-400',
    'border-cyan-200 bg-cyan-50 hover:border-cyan-400',
    'border-amber-200 bg-amber-50 hover:border-amber-400',
    'border-emerald-200 bg-emerald-50 hover:border-emerald-400',
  ];

  return (
    <main className='mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8'>
      <header className='relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-rose-400 px-6 py-8 text-white shadow-xl shadow-violet-200/60 sm:px-9'>
        <div aria-hidden='true' className='absolute -right-12 -top-16 h-48 w-48 rounded-full bg-amber-300/40 blur-2xl' />
        <div aria-hidden='true' className='absolute -bottom-20 left-20 h-48 w-48 rounded-full bg-cyan-300/30 blur-2xl' />
        <div className='relative space-y-3'>
          <p className='text-sm font-semibold uppercase tracking-[0.22em] text-white/80'>One photo · one memory</p>
          <h1 className='text-4xl font-black tracking-tight sm:text-5xl'>1PicDiary</h1>
          <p className='max-w-xl text-base text-white/90 sm:text-lg'>Choose who or what your diary is about, then add a photo and a memory.</p>
          <Link className='inline-flex min-h-11 items-center rounded-full bg-white/95 px-5 py-2 text-sm font-bold text-violet-700 shadow-sm transition hover:bg-amber-50' href='/connect-google-photos'>Set up Google Photos →</Link>
        </div>
      </header>
      <section className='grid gap-4 rounded-3xl border border-white/80 bg-white/85 p-5 shadow-lg shadow-violet-100/60 backdrop-blur sm:p-7' aria-labelledby='choose-subject'>
        <div>
          <p className='mb-1 text-sm font-bold uppercase tracking-wider text-fuchsia-600'>Step 1</p>
          <h2 id='choose-subject' className='text-2xl font-bold text-slate-900'>Choose a subject</h2>
          <p className='mt-1 text-sm text-slate-600'>A subject can be yourself, a child, your marriage, a pet, or anything you want to remember.</p>
        </div>
        {loading ? <p role='status'>Loading your subjects…</p> : error ? (
          <div className='space-y-3'>
            <p role='alert' className='rounded-2xl border border-rose-200 bg-rose-50 p-4 font-medium text-rose-950'>{error}</p>
            {needsReconnect ? (
              <a href='/api/auth/google/start' className={buttonVariants()}>Reconnect Google Photos</a>
            ) : (
              <Button type='button' variant='outline' onClick={() => void loadSubjects()}>Retry connection check</Button>
            )}
          </div>
        ) : profiles.length ? (
          <div className='grid gap-3 sm:grid-cols-2' aria-label='Subjects'>
            {profiles.map((subject, index) => (
              <div key={subject.id}
                className={`group flex min-w-0 items-stretch overflow-hidden rounded-2xl border shadow-sm transition ${subjectColors[index % subjectColors.length]} ${selected === subject.id ? 'ring-2 ring-violet-500 ring-offset-2' : ''}`}>
                <button type='button' aria-pressed={selected === subject.id}
                  onClick={() => setSelected(subject.id)}
                  className='min-h-20 min-w-0 flex-1 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-violet-600'>
                  <span className='block break-words text-lg font-bold text-slate-900'>{subject.name}</span>
                  <span className='block break-words text-sm text-slate-600'>{subject.diary_album_title}</span>
                </button>
                <button type='button'
                  aria-label={`Delete ${subject.name}`}
                  onClick={() => { setDeleteError(''); setSubjectToDelete(subject); }}
                  className='m-2 min-h-11 self-center rounded-xl px-3 text-sm font-semibold text-rose-700 transition hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-rose-600'>
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : <p>Add your first subject and choose their diary album.</p>}
        {ready && (
          <details open={profiles.length === 0} className='rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-rose-50 p-4'>
            <summary className='cursor-pointer py-1 font-bold text-violet-800'>＋ Add a subject and album</summary>
            <form onSubmit={addSubject} className='mt-4 grid gap-3'>
              <label htmlFor='new-subject-name' className='text-sm font-medium'>Subject name</label>
              <Input id='new-subject-name' value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} placeholder='For example: Me, Our marriage, or Luna' disabled={adding} />
              <label htmlFor='new-album-title' className='text-sm font-medium'>Google Photos album prefix</label>
              <Input id='new-album-title' value={albumTitle} onChange={(event) => setCustomAlbum(event.target.value)} required maxLength={186} placeholder="For example: Luna" disabled={adding} />
              <p className='break-words rounded-xl bg-white/75 p-3 text-sm text-slate-600'>Finished diary images: <strong className='text-violet-800'>{albums.base ? albums.diary : 'name_diary'}</strong></p>
              <label className='flex items-center gap-2 text-sm font-medium'>
                <input type='checkbox' checked={saveOriginals} onChange={(event) => setSaveOriginals(event.target.checked)} disabled={adding} aria-describedby='originals-help' />
                Keep original photos too
              </label>
              <p id='originals-help' className='break-words text-sm text-slate-600'>
                Save a copy without diary text in <strong>{albums.base ? albums.originals : 'name_daily_picture'}</strong> so you can revisit it or create a different version later. Uses additional storage in your Google account.
              </p>
              <p className='text-sm text-slate-600'>We create the selected albums, or reuse albums with these names created by 1PicDiary.</p>
              <Button type='submit' disabled={adding || !name.trim() || !albums.base} className='justify-self-start'>{adding ? 'Setting up album…' : 'Add subject and set up album'}</Button>
              {addError && <p role='alert' className='rounded-xl bg-rose-100 p-3 text-sm font-medium text-rose-900'>{addError}</p>}
            </form>
          </details>
        )}
      </section>
      {subjectNotice && <p role='status' className='rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900'>{subjectNotice}</p>}
      {ready && !selected && profiles.length > 0 && <p className='rounded-2xl bg-amber-50 p-4 text-sm text-amber-950'>Select a subject above to upload a photo. Each subject’s unfinished diary stays separate while this page is open.</p>}
      {profiles.map((subject) => (
        <div key={subject.id} hidden={selected !== subject.id}>{renderDiary(subject)}</div>
      ))}

      <dialog ref={deleteDialogRef}
        aria-labelledby='delete-subject-title'
        onCancel={(event) => {
          if (deletingId) event.preventDefault();
          else setSubjectToDelete(null);
        }}
        onClose={() => { if (!deletingId) setSubjectToDelete(null); }}
        className='m-auto w-[min(92vw,30rem)] rounded-3xl border border-rose-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm'>
        <div className='border-b border-rose-100 bg-gradient-to-r from-rose-50 to-amber-50 p-6'>
          <p className='mb-2 text-sm font-bold uppercase tracking-wider text-rose-600'>Please confirm</p>
          <h2 id='delete-subject-title' className='text-2xl font-bold'>Delete {subjectToDelete?.name}?</h2>
        </div>
        <div className='space-y-4 p-6'>
          <p>This removes the subject and all of their diary metadata from 1PicDiary.</p>
          <p className='rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900'><strong>Your Google Photos albums and photos will not be deleted.</strong></p>
          <p className='text-sm text-slate-600'>The deleted 1PicDiary diary records cannot be restored automatically.</p>
          {deleteError && <p role='alert' className='rounded-xl bg-rose-100 p-3 text-sm font-medium text-rose-900'>{deleteError}</p>}
          <div className='flex flex-wrap justify-end gap-3'>
            <Button type='button' variant='outline' disabled={Boolean(deletingId)} onClick={() => setSubjectToDelete(null)}>Cancel</Button>
            <Button type='button' variant='destructive' disabled={Boolean(deletingId)} onClick={() => void deleteSubject()}>{deletingId ? 'Deleting…' : 'Delete subject'}</Button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
