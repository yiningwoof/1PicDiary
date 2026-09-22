import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadPhotoToGooglePhotos } from '@/lib/google-photos';
afterEach(() => vi.unstubAllGlobals());
describe('Google Photos upload result', () => {
  it('does not report success when the batch HTTP response contains a failed item', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('upload-token'))
      .mockResolvedValueOnce(Response.json({ newMediaItemResults: [{ status: { code: 7 } }] })));
    await expect(uploadPhotoToGooglePhotos({ accessToken: 'token', albumId: 'a', fileName: 'a.png', imageBuffer: Buffer.from('photo') }))
      .rejects.toThrow('could not save');
  });
});
