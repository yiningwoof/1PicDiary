export const GOOGLE_PHOTOS_MAX_PHOTO_BYTES = 200 * 1024 * 1024;
export const GOOGLE_PHOTOS_MAX_PHOTO_LABEL = "200 MB";

export function exceedsGooglePhotosPhotoLimit(size: number) {
  return size > GOOGLE_PHOTOS_MAX_PHOTO_BYTES;
}

export const googlePhotosPhotoLimitMessage =
  `Choose a photo up to ${GOOGLE_PHOTOS_MAX_PHOTO_LABEL}, the maximum supported by Google Photos.`;
