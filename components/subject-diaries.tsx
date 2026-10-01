'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { albumNames } from '@/lib/album-names';
import type { DiarySubject } from '@/lib/subjects';

export function SubjectDiaries({ children: renderDiary }: { children: (subject: DiarySubject) => ReactNode }) {
  const [profiles, setProfiles] = useState<DiarySubject[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [customAlbum, setCustomAlbum] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const [saveOriginals, setSaveOriginals] = useState(true);
  const albumTitle = customAlbum ?? name.trim();
  const albums = albumNames(albumTitle);

  async function loadSubjects() {
    setLoading(true);
    setError('');
    setReady(false);
    try {
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

  async function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdding(true);
    setAddError('');
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

  return (
    <main className='mx-auto flex w-full max-w-3xl flex-col gap-5 p-6'>
      <header className='space-y-2'>
        <h1 className='text-2xl font-bold'>1PicDiary</h1>
        <p className='text-gray-600'>Choose who or what your diary is about, then add a photo and a memory.</p>
        <Link className='inline-block text-sm text-blue-600 underline' href='/connect-google-photos'>Set up Google Photos</Link>
      </header>
      <section className='grid gap-3 rounded-lg border border-gray-200 p-4' aria-labelledby='choose-subject'>
        <h2 id='choose-subject' className='text-lg font-semibold'>1. Choose a subject</h2>
        <p className='text-sm text-gray-600'>A subject can be yourself, a child, your marriage, a pet, or anything you want to remember.</p>
        {loading ? <p role='status'>Loading your subjects…</p> : error ? (
          <div className='space-y-3'>
            <p role='alert'>{error}</p>
            <Button type='button' variant='outline' onClick={() => void loadSubjects()}>Retry</Button>
          </div>
        ) : profiles.length ? (
          <div className='flex flex-wrap gap-3' aria-label='Subjects'>
            {profiles.map((subject) => (
              <button key={subject.id} type='button' aria-pressed={selected === subject.id}
                onClick={() => setSelected(subject.id)}
                className={`min-h-16 min-w-0 max-w-full rounded-lg border px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-blue-600 ${selected === subject.id ? 'border-blue-600 bg-blue-50 text-blue-950' : 'border-gray-300'}`}>
                <span className='block break-words font-semibold'>{subject.name}</span>
                <span className='block break-words text-sm'>{subject.diary_album_title}</span>
              </button>
            ))}
          </div>
        ) : <p>Add your first subject and choose their diary album.</p>}
        {ready && (
          <details open={profiles.length === 0}>
            <summary className='cursor-pointer py-2 text-sm font-medium'>Add a subject and album</summary>
            <form onSubmit={addSubject} className='mt-2 grid gap-3'>
              <label htmlFor='new-subject-name' className='text-sm font-medium'>Subject name</label>
              <Input id='new-subject-name' value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} placeholder='For example: Me, Our marriage, or Luna' disabled={adding} />
              <label htmlFor='new-album-title' className='text-sm font-medium'>Google Photos album prefix</label>
              <Input id='new-album-title' value={albumTitle} onChange={(event) => setCustomAlbum(event.target.value)} required maxLength={186} placeholder="For example: Luna" disabled={adding} />
              <p className='break-words text-sm text-gray-600'>Finished diary images: <strong>{albums.base ? albums.diary : 'name_diary'}</strong></p>
              <label className='flex items-center gap-2 text-sm font-medium'>
                <input type='checkbox' checked={saveOriginals} onChange={(event) => setSaveOriginals(event.target.checked)} disabled={adding} aria-describedby='originals-help' />
                Keep original photos too
              </label>
              <p id='originals-help' className='break-words text-sm text-gray-600'>
                Save a copy without diary text in <strong>{albums.base ? albums.originals : 'name_daily_picture'}</strong> so you can revisit it or create a different version later. Uses additional storage in your Google account.
              </p>
              <p className='text-sm text-gray-600'>We create the selected albums, or reuse albums with these names created by 1PicDiary.</p>
              <Button type='submit' disabled={adding || !name.trim() || !albums.base} className='justify-self-start'>{adding ? 'Setting up album…' : 'Add subject and set up album'}</Button>
              {addError && <p role='alert'>{addError}</p>}
            </form>
          </details>
        )}
      </section>
      {ready && !selected && profiles.length > 0 && <p>Select a subject above to upload a photo. Each subject’s unfinished diary stays separate while this page is open.</p>}
      {profiles.map((subject) => (
        <div key={subject.id} hidden={selected !== subject.id}>{renderDiary(subject)}</div>
      ))}
    </main>
  );
}
