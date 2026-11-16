import { describe, expect, it } from 'vitest';
import { extractResponseText, MAX_VOICE_BYTES, MAX_VOICE_SECONDS } from '@/lib/diary-ideas';

describe('voice diary ideas', () => {
  it('uses the two-minute and OpenAI upload limits', () => {
    expect(MAX_VOICE_SECONDS).toBe(120);
    expect(MAX_VOICE_BYTES).toBe(25 * 1024 * 1024);
  });

  it('extracts text from a Responses API payload', () => {
    expect(extractResponseText({ output: [{ content: [{ type: 'output_text', text: 'Polished memory' }] }] })).toBe('Polished memory');
    expect(extractResponseText({ output_text: 'Convenience text' })).toBe('Convenience text');
    expect(extractResponseText(null)).toBe('');
  });
});
