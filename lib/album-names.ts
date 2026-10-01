/** The input is an album prefix; accept an already-entered diary suffix too. */
export function albumNames(input: string) {
  const base = input.trim().replace(/_diary$/i, '').trim();
  return { base, diary: `${base}_diary`, originals: `${base}_daily_picture` };
}
