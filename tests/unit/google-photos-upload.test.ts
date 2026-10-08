import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadPhotoToGooglePhotos } from '@/lib/google-photos';
afterEach(() => vi.unstubAllGlobals());
describe('Google Photos upload result', () => {
  it('sends the user-written diary text as the media item description', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('upload-token'))
      .mockResolvedValueOnce(Response.json({ newMediaItemResults: [{ mediaItem: { id: 'media-id' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    await uploadPhotoToGooglePhotos({
      accessToken: 'token',
      albumId: 'album',
      fileName: 'diary.jpg',
      imageBuffer: Buffer.from('photo'),
      mimeType: 'image/jpeg',
      description: '  A good day  ',
    });

    const batchRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(batchRequest.body))).toEqual({
      albumId: 'album',
      newMediaItems: [{
        description: 'A good day',
        simpleMediaItem: { uploadToken: 'upload-token', fileName: 'diary.jpg' },
      }],
    });
  });

  it('rejects descriptions at Google Photos limit before uploading bytes', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadPhotoToGooglePhotos({
      accessToken: 'token', albumId: 'a', fileName: 'a.png',
      imageBuffer: Buffer.from('photo'), description: 'x'.repeat(1000),
    })).rejects.toThrow('shorter than 1000');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not report success when the batch HTTP response contains a failed item', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('upload-token'))
      .mockResolvedValueOnce(Response.json({ newMediaItemResults: [{ status: { code: 7 } }] })));
    await expect(uploadPhotoToGooglePhotos({ accessToken: 'token', albumId: 'a', fileName: 'a.png', imageBuffer: Buffer.from('photo') }))
      .rejects.toThrow('could not save');
  });
});
