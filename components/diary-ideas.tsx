'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { DiaryIdea } from '@/lib/diary-ideas';

export function DiaryIdeas({ subjectId, subjectName, disabled, selectedIdeaId, onUse, onClearSelection }: {
  subjectId: string;
  subjectName: string;
  disabled: boolean;
  selectedIdeaId: string | null;
  onUse: (idea: DiaryIdea) => void;
  onClearSelection: () => void;
}) {
  const [ideas, setIdeas] = useState<DiaryIdea[]>([]);
  const [newIdea, setNewIdea] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(selectedIdeaId);
  const activeIdea = ideas.find(idea => idea.id === activeIdeaId) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/diary-ideas?subjectId=${encodeURIComponent(subjectId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Unable to load diary ideas.');
        setIdeas(Array.isArray(result.ideas) ? result.ideas : []);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load diary ideas.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [subjectId]);

  async function addIdea() {
    if (!newIdea.trim()) return;
    setWorking(true);
    setError('');
    try {
      const response = await fetch('/api/diary-ideas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, ideaText: newIdea }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save this diary idea.');
      setIdeas(current => [result.idea, ...current]);
      setNewIdea('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save this diary idea.'); }
    finally { setWorking(false); }
  }

  async function deleteIdea(idea: DiaryIdea) {
    setWorking(true);
    setError('');
    try {
      const response = await fetch(`/api/diary-ideas/${idea.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to delete this diary idea.');
      setIdeas(current => current.filter(item => item.id !== idea.id));
      setActiveIdeaId(null);
      if (selectedIdeaId === idea.id) onClearSelection();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete this diary idea.'); }
    finally { setWorking(false); }
  }

  return (
    <section className='rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-fuchsia-50 p-5 shadow-lg shadow-amber-100/50 sm:p-7' aria-labelledby={`${subjectId}-ideas-title`}>
      <p className='text-sm font-bold uppercase tracking-wider text-amber-700'>Memory inbox</p>
      <h3 id={`${subjectId}-ideas-title`} className='mt-1 text-xl font-black text-slate-950'>Ideas for {subjectName}&apos;s diary</h3>
      <p className='mt-1 text-sm text-slate-600'>Capture a moment now. When you make a diary entry, pick one below or write something new.</p>
      <div className='mt-4 grid gap-2'>
        <Textarea value={newIdea} disabled={disabled || working} onChange={event => setNewIdea(event.target.value)} placeholder='What happened? Add a funny quote, milestone, or small moment…' />
        <Button type='button' disabled={disabled || working || !newIdea.trim()} onClick={addIdea} className='sm:justify-self-start'>Add to memory inbox</Button>
      </div>
      {error ? <p role='alert' className='mt-3 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-800'>{error}</p> : null}
      <div className='mt-5'>
        {loading ? <p role='status' className='text-sm text-slate-600'>Loading saved ideas…</p>
          : ideas.length === 0 ? <p className='rounded-2xl border border-dashed border-amber-300 bg-white/70 p-4 text-sm text-slate-600'>No waiting ideas yet.</p>
            : (
              <div className='overflow-hidden rounded-2xl border border-amber-200 bg-white/85 shadow-sm'>
                <div className='grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-amber-200 bg-amber-50/90 px-3 py-2' role='toolbar' aria-label='Memory inbox actions'>
                  <span className='text-xs font-bold uppercase tracking-wide text-amber-800'>Saved ideas</span>
                  <Button type='button' disabled={disabled || working || !activeIdea} onClick={() => activeIdea && onUse(activeIdea)} className='min-h-10 px-3 py-2 text-xs'>
                    {activeIdea?.id === selectedIdeaId ? 'Using for diary' : 'Use for diary'}
                  </Button>
                  <button type='button' disabled={disabled || working || !activeIdea} onClick={() => activeIdea && void deleteIdea(activeIdea)}
                    className='grid h-10 w-10 place-items-center rounded-xl border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-35'
                    aria-label='Delete selected idea' title='Delete selected idea'>
                    <svg viewBox='0 0 24 24' className='h-5 w-5' aria-hidden='true' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                      <path d='M3 6h18' /><path d='M8 6V4h8v2' /><path d='M19 6l-1 14H6L5 6' /><path d='M10 11v5M14 11v5' />
                    </svg>
                  </button>
                </div>
                <div role='listbox' aria-label='Saved diary ideas' className='divide-y divide-amber-100'>
                  {ideas.map(idea => {
                    const active = activeIdeaId === idea.id;
                    return (
                      <button key={idea.id} type='button' role='option' aria-selected={active} disabled={disabled || working}
                        onClick={() => setActiveIdeaId(idea.id)}
                        className={`block w-full px-4 py-3 text-left transition focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'bg-violet-100 ring-2 ring-inset ring-violet-500' : 'bg-white/70 hover:bg-amber-50'}`}>
                        <span className='block whitespace-pre-wrap text-sm font-medium text-slate-900'>{idea.idea_text}</span>
                        <span className='mt-1 flex items-center justify-between gap-2 text-xs text-slate-500'>
                          <span>Captured {new Date(idea.created_at).toLocaleString()}</span>
                          {selectedIdeaId === idea.id ? <span className='shrink-0 rounded-full bg-violet-600 px-2 py-0.5 font-bold text-white'>In diary</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
      </div>
    </section>
  );
}
