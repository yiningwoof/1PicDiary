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
      <div className='mt-5 grid gap-3'>
        {loading ? <p role='status' className='text-sm text-slate-600'>Loading saved ideas…</p>
          : ideas.length === 0 ? <p className='rounded-2xl border border-dashed border-amber-300 bg-white/70 p-4 text-sm text-slate-600'>No waiting ideas yet.</p>
            : ideas.map(idea => (
              <article key={idea.id} className={`rounded-2xl border p-4 ${selectedIdeaId === idea.id ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200' : 'border-amber-200 bg-white/85'}`}>
                <p className='whitespace-pre-wrap text-sm font-medium text-slate-900'>{idea.idea_text}</p>
                <p className='mt-2 text-xs text-slate-500'>Captured {new Date(idea.created_at).toLocaleString()}</p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  <Button type='button' disabled={disabled || working} onClick={() => onUse(idea)}>{selectedIdeaId === idea.id ? 'Selected for this diary' : 'Use for diary'}</Button>
                  <Button type='button' variant='outline' disabled={disabled || working} onClick={() => void deleteIdea(idea)}>Delete</Button>
                </div>
              </article>
            ))}
      </div>
    </section>
  );
}
