import { isDiaryDate } from '@/lib/diary-date';

export function formatDiaryDateForOverlay(diaryDate: string): string {
  if (!isDiaryDate(diaryDate)) {
    throw new Error('Choose a valid diary date (YYYY-MM-DD).');
  }

  const [year, month, day] = diaryDate.split('-').map(Number);
  return `${month}/${day}/${year}`;
}

export function diaryOverlayText(
  diaryDate: string,
  diaryText: string,
): string {
  return `${formatDiaryDateForOverlay(diaryDate)}\n${diaryText.trim()}`;
}
