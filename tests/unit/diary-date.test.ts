import { describe, expect, it } from 'vitest';
import { isDiaryDate, localDiaryDate } from '@/lib/diary-date';
import { diaryOverlayText, formatDiaryDateForOverlay } from '@/lib/diary-overlay-text';
describe('diary calendar dates', () => {
  it('accepts leap days only in leap years', () => {
    expect(isDiaryDate('2024-02-29')).toBe(true);
    expect(isDiaryDate('2026-02-29')).toBe(false);
  });
  it('uses local calendar fields instead of UTC for today', () => {
    const date = new Date(2026, 8, 13, 23, 45);
    expect(localDiaryDate(date)).toBe('2026-09-13');
  });
  it.each(['0000-01-01', '2026-04-31', '2026-9-1', '2026-09-13T00:00:00Z'])('rejects %s', value => {
    expect(isDiaryDate(value)).toBe(false);
  });
  it('formats the image date without leading zeroes', () => {
    expect(formatDiaryDateForOverlay('2026-09-01')).toBe('9/1/2026');
    expect(formatDiaryDateForOverlay('2026-11-13')).toBe('11/13/2026');
  });
  it('puts the date on the first line of generated diary text', () => {
    expect(diaryOverlayText('2026-09-01', '今天很开心')).toBe(
      '9/1/2026\n今天很开心',
    );
  });
});
