import { NextResponse } from 'next/server';
import { extractResponseText, MAX_VOICE_BYTES, MAX_VOICE_SECONDS, UUID_PATTERN } from '@/lib/diary-ideas';
import { hasTrustedRequestOrigin } from '@/lib/request-origin';
import { getSubjectAccount, subjectAccountError, SubjectAccountError } from '@/lib/subject-account';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (!hasTrustedRequestOrigin(request)) throw new SubjectAccountError('Please record memories from 1PicDiary.', 403);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new SubjectAccountError('Voice memories are not configured yet. Add OPENAI_API_KEY to the server.', 503);
    const { ownerId, supabase } = await getSubjectAccount();
    const form = await request.formData();
    const subjectId = String(form.get('subjectId') ?? '');
    const audio = form.get('audio');
    const duration = Number(form.get('durationSeconds'));
    if (!UUID_PATTERN.test(subjectId)) throw new SubjectAccountError('Select a valid subject.', 400);
    if (!(audio instanceof File) || audio.size === 0) throw new SubjectAccountError('Record some audio before processing it.', 400);
    if (audio.size > MAX_VOICE_BYTES) throw new SubjectAccountError('That recording is over the 25 MB transcription limit.', 413);
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_VOICE_SECONDS) throw new SubjectAccountError('Voice memories can be up to two minutes long.', 400);
    const { data: subject, error } = await supabase.from('subjects').select('id').eq('id', subjectId).eq('google_owner_id', ownerId).maybeSingle();
    if (error) throw new SubjectAccountError('Your subject could not be checked. Please retry.', 503);
    if (!subject) throw new SubjectAccountError('That subject is not available for the connected Google account.', 404);

    const transcriptionModel = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-transcribe';
    const audioForm = new FormData();
    audioForm.set('model', transcriptionModel);
    audioForm.set('file', audio, audio.name || 'memory.webm');
    audioForm.set('prompt', 'A personal family memory. Preserve names, exact quotes, Chinese and English code-switching, and factual details.');
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: audioForm,
    });
    const transcriptionJson = await transcriptionResponse.json().catch(() => null) as { text?: unknown; error?: { message?: unknown } } | null;
    if (!transcriptionResponse.ok) throw new SubjectAccountError(typeof transcriptionJson?.error?.message === 'string' ? transcriptionJson.error.message : 'The recording could not be transcribed.', 502);
    const transcript = typeof transcriptionJson?.text === 'string' ? transcriptionJson.text.trim() : '';
    if (!transcript) throw new SubjectAccountError('No speech was detected. Try recording again in a quieter place.', 422);

    const summaryModel = process.env.OPENAI_SUMMARY_MODEL || 'gpt-6-luna';
    const summaryResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: summaryModel,
        instructions: [
          'Rewrite the transcript as an extremely concise diary note in the same primary language.',
          'Keep only concrete information the speaker actually provided, including important names, events, and exact quotes.',
          'Preserve natural Chinese-English code-switching.',
          'Remove filler words, repetition, false starts, and unnecessary transitions.',
          'Never invent, infer, explain, praise, dramatize, moralize, or add emotion, context, conclusions, or significance.',
          'Do not add generic phrases such as “值得记录”, “小小里程碑”, “温馨时刻”, “珍贵回忆”, or their equivalents.',
          'Do not add a date, title, heading, introduction, closing sentence, or commentary.',
          'Use as few words as possible without losing a concrete fact or important quote, because the text must fit in a small area on a photo.',
          'Return only the final diary text.',
        ].join(' '),
        input: transcript,
        reasoning: { effort: 'none' },
        max_output_tokens: 600,
      }),
    });
    const summaryJson = await summaryResponse.json().catch(() => null) as { output_text?: unknown; output?: unknown; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: unknown } } | null;
    if (!summaryResponse.ok) throw new SubjectAccountError(typeof summaryJson?.error?.message === 'string' ? summaryJson.error.message : 'The transcript could not be rewritten.', 502);
    const summary = extractResponseText(summaryJson);
    if (!summary) throw new SubjectAccountError('The AI returned an empty draft. Please try again.', 502);
    return NextResponse.json({ transcript, summary, durationSeconds: Math.round(duration), transcriptionModel, summaryModel, aiInputTokens: summaryJson?.usage?.input_tokens ?? null, aiOutputTokens: summaryJson?.usage?.output_tokens ?? null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return subjectAccountError(error); }
}
