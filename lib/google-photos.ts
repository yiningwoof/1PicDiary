const GOOGLE_PHOTOS_API = "https://photoslibrary.googleapis.com/v1";

type Album = {
  id: string;
  title: string;
};

async function photosFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${GOOGLE_PHOTOS_API}${path}`, {
    ...init,
    headers: {
      Authorization: ["Bearer", accessToken].join(" "),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Photos API error: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getOrCreateAlbum(accessToken: string, title: string) {
  let nextPageToken: string | null = null;

  do {
    const search = new URLSearchParams({ pageSize: "50" });
    if (nextPageToken) {
      search.set("pageToken", nextPageToken);
    }

    const albums = await photosFetch<{ albums?: Album[]; nextPageToken?: string }>(
      accessToken,
      `/albums?${search.toString()}`
    );

    const existing = albums.albums?.find((album) => album.title === title);
    if (existing) {
      return existing.id;
    }

    nextPageToken = albums.nextPageToken ?? null;
  } while (nextPageToken);

  if (title.length === 0) {
    throw new Error("Album title is required");
  }

  const created = await photosFetch<{ id: string }>(accessToken, "/albums", {
    method: "POST",
    body: JSON.stringify({ album: { title } }),
  });

  return created.id;
}

export async function uploadPhotoToGooglePhotos({
  accessToken,
  albumId,
  fileName,
  imageBuffer,
  mimeType = "image/png",
}: {
  accessToken: string;
  albumId: string;
  fileName: string;
  imageBuffer: Buffer;
  mimeType?: string;
}) {
  const uploadResponse = await fetch("https://photoslibrary.googleapis.com/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: ["Bearer", accessToken].join(" "),
      "Content-type": "application/octet-stream",
      "X-Goog-Upload-Content-Type": mimeType,
      "X-Goog-Upload-Protocol": "raw",
      "X-Goog-Upload-File-Name": fileName,
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!uploadResponse.ok) {
    throw new Error(`Google Photos upload failed: ${uploadResponse.status}`);
  }

  const uploadToken = await uploadResponse.text();

  const batch = await photosFetch<{
    newMediaItemResults?: Array<{ status?: { code?: number }; mediaItem?: { id: string } }>;
  }>(accessToken, "/mediaItems:batchCreate", {
    method: "POST",
    body: JSON.stringify({
      albumId,
      newMediaItems: [
        {
          simpleMediaItem: { uploadToken, fileName },
        },
      ],
    }),
  });

  const result = batch.newMediaItemResults?.[0];
  if (result?.status?.code || !result?.mediaItem?.id) {
    throw new Error("Google Photos could not save this image to the subject’s album. Check that the album still exists and reconnect if needed.");
  }
  return result.mediaItem.id;
}
