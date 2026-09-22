import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  account: vi.fn(), upload: vi.fn(), compose: vi.fn(), cookies: vi.fn(),
  getAlbum: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('@/lib/subject-account', async (original) => ({
  ...await original<typeof import('@/lib/subject-account')>(), getSubjectAccount: mocks.account,
}));
vi.mock('@/lib/google-photos', () => ({ uploadPhotoToGooglePhotos: mocks.upload, getOrCreateAlbum: mocks.getAlbum }));
vi.mock('@/lib/image', async (original) => ({
  ...await original<typeof import('@/lib/image')>(), composeDiaryImageWithLayout: mocks.compose,
}));
vi.mock('@/lib/supabase', () => ({ getSupabaseServerClient: () => null }));
import { DEFAULT_LAYOUT } from '@/lib/text-layout';
import { POST as save } from '@/app/api/save-diary/route';
import { GET as list, POST as add } from '@/app/api/subjects/route';

function dbFor(subject: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: subject }), insert: vi.fn().mockResolvedValue({ error: null }), order: vi.fn().mockResolvedValue({ data: [] }) };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { query, from: vi.fn().mockReturnValue(query), get storage() { throw new Error('Supabase Storage must not be used'); } };
}
function request(id: string, diaryDate = '2026-09-01') {
  const form = new FormData();
  form.set('photo', new File(['image'], 'photo.png', { type: 'image/png' }));
  form.set('subjectId', id);
  form.set('diaryText', 'A good day');
  form.set('diaryDate', diaryDate);
  form.set('subjectName', 'untrusted name');
  form.set('albumTitle', 'wrong album');
  return new Request('http://localhost/api/save-diary', { method: 'POST', body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ get: () => ({ value: 'token' }) });
  mocks.compose.mockResolvedValue({ imageBuffer: Buffer.from('composed'), textLayout: DEFAULT_LAYOUT });
  mocks.upload.mockResolvedValue('media-id');
});

describe('subject album routing', () => {
  it.each([
    { id: '00000000-0000-4000-8000-000000000001', name: 'A', diary_album_title: "A's Diary", google_diary_album_id: 'album-a' },
    { id: '00000000-0000-4000-8000-000000000002', name: 'B', diary_album_title: "B's Diary", google_diary_album_id: 'album-b' },
    { id: '00000000-0000-4000-8000-000000000003', name: 'Our marriage', diary_album_title: 'Our Marriage Diary', google_diary_album_id: 'album-marriage' },
    { id: '00000000-0000-4000-8000-000000000004', name: 'Luna', diary_album_title: 'Luna Diary', google_diary_album_id: 'album-pet' },
  ])('saves $name to the stored album and ignores a supplied destination', async (subject) => {
    const db = dbFor(subject);
    mocks.account.mockResolvedValue({ ownerId: 'owner', accessToken: 'token', supabase: db });
    const response = await save(request(subject.id));
    expect(response.status).toBe(200);
    expect(db.query.eq).toHaveBeenCalledWith('id', subject.id);
    expect(db.query.eq).toHaveBeenCalledWith('google_owner_id', 'owner');
    expect(mocks.compose).toHaveBeenCalledWith(expect.objectContaining({ subjectName: subject.name }));
    expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({ albumId: subject.google_diary_album_id }));
    expect(mocks.getAlbum).not.toHaveBeenCalled();
    expect(db.query.insert).toHaveBeenCalledWith({
      subject_id: subject.id,
      diary_text: 'A good day', diary_date: '2026-09-01', text_layout: DEFAULT_LAYOUT,
      google_media_item_id: 'media-id', google_original_media_item_id: null,
    });
    expect((await response.json()).warnings).toEqual([]);
  });
  it.each(['', '2026-02-30', '2026-13-01', '09/01/2026'])('rejects invalid date %s before uploading', async (date) => {
    const response = await save(request('00000000-0000-4000-8000-000000000001', date));
    expect(response.status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.account).not.toHaveBeenCalled();
  });
  it('returns the Google reference with a warning if the metadata write fails', async () => {
    const subject = { id: '00000000-0000-4000-8000-000000000001', name: 'A', diary_album_title: 'A diary', google_diary_album_id: 'album-a' };
    const db = dbFor(subject);
    db.query.insert.mockResolvedValue({ error: { message: 'database unavailable' } });
    mocks.account.mockResolvedValue({ ownerId: 'owner', supabase: db });
    const response = await save(request(subject.id));
    const payload = await response.json();
    expect(payload.mediaItemId).toBe('media-id');
    expect(payload.warnings[0]).toContain('diary record could not be saved');
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
  it('does not upload when the subject is not owned by the connected account', async () => {
    const db = dbFor(null);
    mocks.account.mockResolvedValue({ ownerId: 'other-owner', supabase: db });
    expect((await save(request('00000000-0000-4000-8000-000000000001'))).status).toBe(404);
    expect(db.query.eq).toHaveBeenCalledWith('google_owner_id', 'other-owner');
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('lists only profiles belonging to the verified account', async () => {
    const db = dbFor(null);
    mocks.account.mockResolvedValue({ ownerId: 'owner', supabase: db });
    const response = await list();
    expect(response.status).toBe(200);
    expect(db.query.eq).toHaveBeenCalledWith('google_owner_id', 'owner');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects duplicate album names before creating another album', async () => {
    const query = { select: vi.fn(), eq: vi.fn().mockResolvedValue({ data: [{ name: 'A', diary_album_title: 'A_diary' }] }) };
    query.select.mockReturnValue(query);
    mocks.account.mockResolvedValue({ ownerId: 'owner', supabase: { from: () => query } });
    const response = await add(new Request('http://localhost/api/subjects', { method: 'POST', body: JSON.stringify({ name: 'B', albumTitle: "a" }) }));
    expect(response.status).toBe(409);
    expect(mocks.getAlbum).not.toHaveBeenCalled();
  });
  it('stores the verified owner and returned Google album ID when adding a subject', async () => {
    const saved = { id: 'subject-b', name: 'B', diary_album_title: "B's Diary" };
    const query = { select: vi.fn(), eq: vi.fn().mockResolvedValue({ data: [] }), insert: vi.fn(), single: vi.fn().mockResolvedValue({ data: saved }) };
    query.select.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    mocks.account.mockResolvedValue({ ownerId: 'owner', accessToken: 'token', supabase: { from: () => query } });
    mocks.getAlbum.mockResolvedValueOnce('album-b').mockResolvedValueOnce('original-b');
    const response = await add(new Request('http://localhost/api/subjects', { method: 'POST', body: JSON.stringify({ name: 'B', albumTitle: "B", google_owner_id: 'forged' }) }));
    expect(response.status).toBe(201);
    expect(query.insert).toHaveBeenCalledWith({ google_owner_id: 'owner', name: 'B', diary_album_title: "B_diary", google_diary_album_id: 'album-b', save_originals: true, originals_album_title: "B_daily_picture", google_originals_album_id: "original-b" });
  });
  it('uploads unchanged original bytes and stores both media references when enabled', async () => {
    const subject = { id: '00000000-0000-4000-8000-000000000001', name: 'A', google_diary_album_id: 'diary-album', save_originals: true, google_originals_album_id: 'original-album' };
    const db = dbFor(subject);
    mocks.account.mockResolvedValue({ ownerId: 'owner', supabase: db });
    mocks.upload.mockResolvedValueOnce('diary-media').mockResolvedValueOnce('original-media');
    const response = await save(request(subject.id));
    expect(response.status).toBe(200);
    expect(mocks.upload).toHaveBeenNthCalledWith(2, expect.objectContaining({ albumId: 'original-album', imageBuffer: Buffer.from('image'), mimeType: 'image/png', fileName: 'photo.png' }));
    expect(db.query.insert).toHaveBeenCalledWith(expect.objectContaining({ google_media_item_id: 'diary-media', google_original_media_item_id: 'original-media' }));
  });
  it('keeps the diary reference and warns if the original upload fails', async () => {
    const subject = { id: '00000000-0000-4000-8000-000000000001', name: 'A', google_diary_album_id: 'diary-album', save_originals: true, google_originals_album_id: 'original-album' };
    const db = dbFor(subject);
    mocks.account.mockResolvedValue({ ownerId: 'owner', supabase: db });
    mocks.upload.mockResolvedValueOnce('diary-media').mockRejectedValueOnce(new Error('failed'));
    const payload = await (await save(request(subject.id))).json();
    expect(payload.mediaItemId).toBe('diary-media');
    expect(payload.originalMediaItemId).toBeNull();
    expect(payload.warnings[0]).toContain('original photo');
    expect(db.query.insert).toHaveBeenCalledWith(expect.objectContaining({ google_media_item_id: 'diary-media', google_original_media_item_id: null }));
  });
  it('creates only the diary album when the checkbox is unchecked', async () => {
    const query = { select: vi.fn(), eq: vi.fn().mockResolvedValue({ data: [] }), insert: vi.fn(), single: vi.fn().mockResolvedValue({ data: { id: 'a' } }) };
    query.select.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    mocks.account.mockResolvedValue({ ownerId: 'owner', accessToken: 'token', supabase: { from: () => query } });
    mocks.getAlbum.mockResolvedValue('diary-album');
    const response = await add(new Request('http://localhost/api/subjects', { method: 'POST', body: JSON.stringify({ name: 'A', albumTitle: 'A', saveOriginals: false }) }));
    expect(response.status).toBe(201);
    expect(mocks.getAlbum).toHaveBeenCalledTimes(1);
    expect(mocks.getAlbum).toHaveBeenCalledWith('token', 'A_diary');
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ save_originals: false, google_originals_album_id: null, originals_album_title: null }));
  });

});
