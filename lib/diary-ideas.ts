export type DiaryIdea = {
  id: string;
  subject_id: string;
  idea_text: string;
  source_type: 'typed' | 'voice';
  raw_transcript: string | null;
  audio_duration_seconds: number | null;
  transcription_model: string | null;
  summary_model: string | null;
  ai_input_tokens: number | null;
  ai_output_tokens: number | null;
  created_at: string;
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAX_VOICE_SECONDS = 120;
export const MAX_VOICE_BYTES = 25 * 1024 * 1024;

export function extractResponseText(response: unknown) {
  if (!response || typeof response !== 'object') return '';
  const value = response as { output_text?: unknown; output?: unknown };
  if (typeof value.output_text === 'string') return value.output_text.trim();
  if (!Array.isArray(value.output)) return '';
  return value.output.flatMap(item => {
    if (!item || typeof item !== 'object' || !Array.isArray((item as { content?: unknown }).content)) return [];
    return ((item as { content: unknown[] }).content).flatMap(content => {
      if (!content || typeof content !== 'object') return [];
      const text = (content as { text?: unknown }).text;
      return typeof text === 'string' ? [text] : [];
    });
  }).join('\n').trim();
}
