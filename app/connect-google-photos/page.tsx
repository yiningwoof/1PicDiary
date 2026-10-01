import Link from "next/link";
import { cookies } from "next/headers";

const AUTH_ERRORS: Record<string, string> = {
  cancelled: "Google connection was cancelled. Try again when you are ready and allow both Google Photos permissions.",
  missing_code: "Google did not finish connecting. Please try again.",
  state_error: "This connection attempt expired or could not be verified. Please start again from this page.",
  token_error: "We could not complete your Google connection. Please try again.",
};

export default async function ConnectGooglePhotos({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string | string[] }>;
}) {
  const { auth } = await searchParams;
  const cookieStore = await cookies();
  const connected = Boolean(cookieStore.get("google_access_token")?.value);
  const error = typeof auth === "string" ? AUTH_ERRORS[auth] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <Link href="/" className="text-sm text-blue-600 underline">
        Back to your diary
      </Link>
      <header className="space-y-2">
        <p className="text-sm font-medium text-gray-500">1PicDiary · Google Photos setup</p>
        <h1 className="text-3xl font-bold">A home for your memories</h1>
        <p className="text-gray-600">
          Connect Google Photos so each photo and diary line you compose can be
          saved together as an image in your own album.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {error}
        </p>
      ) : connected ? (
        <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-950">
          Google sign-in is connected for this session. Add each subject and their album, then choose whose diary to create.
        </p>
      ) : null}

      <ol className="grid gap-4">
        <li className="space-y-3 rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-semibold">1. Connect your Google account</h2>
          <p className="text-sm text-gray-600">
            Choose the account where you want to keep your diary photos. On
            Google’s permission screen, allow 1PicDiary to add photos and to
            view the photos and albums it created. This lets us find and reuse
            your diary album on future saves.
          </p>
          <p className="text-sm text-gray-600">
            These Photos permissions do not give us access to your entire
            existing photo library.
          </p>
          <a href="/api/auth/google/start" className="inline-flex min-h-11 items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {connected ? "Reconnect Google Photos" : "Connect Google Photos"}
          </a>
          <p className="text-xs text-gray-500">
            Previously connected? Reconnect once to grant the album permission.
            If your session expires later, return here to connect again.
          </p>
        </li>

        <li className="space-y-3 rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-semibold">2. Add each subject and their album</h2>
          <p className="text-sm text-gray-600">
            In the diary editor, choose “Add a subject and album”. Enter the subject’s
            name and an album prefix, such as “Me”, “Our Marriage”, or “Luna”. With “Keep original photos too” checked, we create the _diary and
            _daily_picture albums. Uncheck it to keep only finished diary images. We remember the selected albums for that subject in
            your connected account. Future saves use those same destinations.
          </p>
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-950">
            <p className="font-semibold">No need to create an album yourself.</p>
            <p className="mt-1">
              Google only lets us save into albums created by this app. An album
              you created directly in Google Photos cannot be connected, even if
              it has the same name. In that case, we create a separate album.
            </p>
          </div>
        </li>

        <li className="space-y-3 rounded-lg border border-gray-200 p-5">
          <h2 className="text-lg font-semibold">3. Preview and save your first memory</h2>
          <p className="text-sm text-gray-600">
            Pick a subject, upload a photo, and write a diary line. Adjust the text,
            preview your image, then choose “Save to Google Photos”. The saved
            image includes the subject’s name and diary text. Find it in Google
            Photos in the selected subject’s album.
          </p>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium">
            {connected ? "Continue to your diary" : "Try the diary editor"}
          </Link>
          <p className="text-xs text-gray-500">
            Connect first to load your subjects and albums, then preview and save
            a diary for the selected subject. Uploaded images may count toward your Google storage.
          </p>
        </li>
      </ol>
      <p className="text-sm text-gray-500">
        Use the same Google account on each device to load your subjects and their
        albums. You do not need a new album for every diary entry.
      </p>
    </main>
  );
}
