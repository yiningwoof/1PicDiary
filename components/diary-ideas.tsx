'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MAX_VOICE_SECONDS, type DiaryIdea } from '@/lib/diary-ideas';

type VoiceDraft = {
  transcript: string; durationSeconds: number; transcriptionModel: string; summaryModel: string;
  aiInputTokens: number | null; aiOutputTokens: number | null;
};

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
  const [recording, setRecording] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function processRecording(blob: Blob, durationSeconds: number) {
    setProcessingVoice(true); setError('');
    try {
      const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const form = new FormData();
      form.set('subjectId', subjectId); form.set('durationSeconds', String(durationSeconds));
      form.set('audio', new File([blob], `memory.${extension}`, { type: blob.type || 'audio/webm' }));
      const response = await fetch('/api/diary-ideas/transcribe', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to process this recording.');
      setVoiceDraft(result); setNewIdea(result.summary);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to process this recording.'); }
    finally { setProcessingVoice(false); }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    const duration = Math.min(MAX_VOICE_SECONDS, Math.max(1, Math.ceil((performance.now() - startedAtRef.current) / 1000)));
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null; setElapsed(duration); recorder.stop(); setRecording(false);
  }

  async function startRecording() {
    setError(''); setVoiceDraft(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Voice recording is not supported by this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; chunksRef.current = [];
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop()); streamRef.current = null;
        const duration = Math.min(MAX_VOICE_SECONDS, Math.max(1, Math.ceil((performance.now() - startedAtRef.current) / 1000)));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        void processRecording(blob, duration);
      };
      startedAtRef.current = performance.now(); setElapsed(0); setRecording(true); recorder.start(1000);
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((performance.now() - startedAtRef.current) / 1000);
        setElapsed(Math.min(seconds, MAX_VOICE_SECONDS));
        if (seconds >= MAX_VOICE_SECONDS) stopRecording();
      }, 250);
    } catch { setError('Microphone access was not granted. Allow microphone access and try again.'); }
  }

  async function addIdea() {
    if (!newIdea.trim()) return;
    setWorking(true);
    setError('');
    try {
      const response = await fetch('/api/diary-ideas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, ideaText: newIdea, ...(voiceDraft ? {
          sourceType: 'voice', rawTranscript: voiceDraft.transcript, audioDurationSeconds: voiceDraft.durationSeconds,
          transcriptionModel: voiceDraft.transcriptionModel, summaryModel: voiceDraft.summaryModel,
          aiInputTokens: voiceDraft.aiInputTokens, aiOutputTokens: voiceDraft.aiOutputTokens,
        } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save this diary idea.');
      setIdeas(current => [result.idea, ...current]);
      setNewIdea('');
      setVoiceDraft(null);
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
        <Textarea value={newIdea} disabled={disabled || working || processingVoice || recording} onChange={event => setNewIdea(event.target.value)} placeholder='What happened? Add a funny quote, milestone, or small moment…' />
        <div className='rounded-2xl border border-violet-200 bg-white/80 p-3'>
          <div className='flex flex-wrap items-center gap-3'>
            {!recording ? <Button type='button' variant='outline' disabled={disabled || working || processingVoice} onClick={() => void startRecording()}>
              <span aria-hidden='true'>🎙️</span> Record a memory
            </Button> : <Button type='button' disabled={disabled} onClick={stopRecording} className='bg-rose-600 hover:bg-rose-700'>
              <span className='inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-white' /> Stop recording
            </Button>}
            {recording ? <span role='status' className='font-bold text-rose-700'>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} / 2:00</span> : null}
            {processingVoice ? <span role='status' className='flex items-center gap-2 font-semibold text-violet-800'><span className='h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent' />Transcribing and writing…</span> : null}
          </div>
          {recording ? <div className='mt-3 h-2 overflow-hidden rounded-full bg-rose-100'><div className='h-full bg-rose-500 transition-[width]' style={{ width: `${elapsed / MAX_VOICE_SECONDS * 100}%` }} /></div> : null}
          {voiceDraft ? <div className='mt-3 rounded-xl bg-violet-50 p-3 text-sm text-slate-700'>
            <p className='font-bold text-violet-900'>AI draft ready — edit it above before saving.</p>
            <details className='mt-2'><summary className='cursor-pointer font-semibold'>View original transcript</summary><p className='mt-2 whitespace-pre-wrap'>{voiceDraft.transcript}</p></details>
            <button type='button' className='mt-2 font-semibold text-rose-700 underline' onClick={() => { setVoiceDraft(null); setNewIdea(''); }}>Discard voice draft</button>
          </div> : null}
          <p className='mt-2 text-xs text-slate-500'>Up to 2 minutes. 1PicDiary does not save the audio; it saves the transcript and your edited memory.</p>
        </div>
        <Button type='button' disabled={disabled || working || processingVoice || recording || !newIdea.trim()} onClick={addIdea} className='sm:justify-self-start'>Add to memory inbox</Button>
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
                          <span>{idea.source_type === 'voice' ? 'Voice · ' : ''}Captured {new Date(idea.created_at).toLocaleString()}</span>
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
