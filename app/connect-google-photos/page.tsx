import Link from "next/link";
import { hasGoogleSession } from "@/lib/google-session";

const AUTH_ERRORS: Record<string, string> = {
  cancelled: "Google connection was cancelled. Try again when you are ready and allow both Google Photos permissions.",
  missing_code: "Google did not finish connecting. Please try again.",
  state_error: "This connection attempt expired or could not be verified. Please start again from this page.",
  token_error: "We could not complete your Google connection. Please try again.",
  token_exchange_error: "Google rejected the authorization code. Please start a new connection attempt.",
  missing_refresh_token: "Google did not provide long-term access. Please connect again and approve the requested access.",
  identity_error: "Google connected, but we could not identify the account. Please try again.",
  encryption_error: "The server could not secure your Google session. Check the token encryption key configuration.",
  session_storage_error: "Google connected, but the session could not be saved. Check the google_sessions table and permissions.",
};

export default async function ConnectGooglePhotos({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string | string[] }>;
}) {
  const { auth } = await searchParams;
  const connected = await hasGoogleSession();
  const error = typeof auth === "string" ? AUTH_ERRORS[auth] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500 via-blue-500 to-violet-600 px-6 py-8 text-white shadow-xl shadow-cyan-200/60 sm:px-9">
        <div aria-hidden="true" className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-amber-300/40 blur-2xl" />
        <div className="relative space-y-3">
        <Link href="/" className="inline-flex rounded-full bg-white/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/30">
          ← Back to your diary
        </Link>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/75">1PicDiary · Google Photos</p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">A home for your memories</h1>
        <p className="max-w-2xl text-white/90">
          Connect Google Photos so each photo and diary line you compose can be
          saved together as an image in your own album.
        </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950 shadow-sm">
          {error}
        </p>
      ) : connected ? (
        <p role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-950 shadow-sm">
          Google Photos is connected. This connection remains available until you disconnect it or Google revokes access.
        </p>
      ) : null}

      <ol className="grid gap-5">
        <li className="space-y-3 rounded-3xl border border-cyan-100 bg-white/85 p-6 shadow-lg shadow-cyan-100/50 backdrop-blur">
          <p className="text-sm font-bold uppercase tracking-wider text-cyan-700">Step 1</p>
          <h2 className="text-2xl font-bold">Connect your Google account</h2>
          <p className="text-sm text-slate-600">
            Choose the account where you want to keep your diary photos. On
            Google’s permission screen, allow 1PicDiary to add photos and to
            view the photos and albums it created. This lets us find and reuse
            your diary album on future saves.
          </p>
          <p className="text-sm text-slate-600">
            These Photos permissions do not give us access to your entire
            existing photo library.
          </p>
          <a href="/api/auth/google/start" className="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-cyan-200 transition hover:-translate-y-0.5 hover:shadow-lg">
            {connected ? "Reconnect Google Photos" : "Connect Google Photos"}
          </a>
          {connected ? (
            <form action="/api/auth/google/disconnect" method="post" className="inline-block pl-3">
              <button type="submit" className="min-h-11 rounded-xl border border-violet-200 bg-white px-5 py-2 text-sm font-bold text-violet-800 hover:bg-violet-50">
                Disconnect
              </button>
            </form>
          ) : null}
          <p className="text-xs text-slate-500">
            Reconnect only if you want to switch Google accounts or Google asks you to grant access again.
          </p>
        </li>

        <li className="space-y-3 rounded-3xl border border-violet-100 bg-white/85 p-6 shadow-lg shadow-violet-100/50 backdrop-blur">
          <p className="text-sm font-bold uppercase tracking-wider text-violet-700">Step 2</p>
          <h2 className="text-2xl font-bold">Add each subject and their album</h2>
          <p className="text-sm text-slate-600">
            In the diary editor, choose “Add a subject and album”. Enter the subject’s
            name and an album prefix, such as “Me”, “Our Marriage”, or “Luna”. With “Keep original photos too” checked, we create the _diary and
            _daily_picture albums. Uncheck it to keep only finished diary images. We remember the selected albums for that subject in
            your connected account. Future saves use those same destinations.
          </p>
          <div className="rounded-2xl bg-violet-50 p-4 text-sm text-violet-950">
            <p className="font-semibold">No need to create an album yourself.</p>
            <p className="mt-1">
              Google only lets us save into albums created by this app. An album
              you created directly in Google Photos cannot be connected, even if
              it has the same name. In that case, we create a separate album.
            </p>
          </div>
        </li>

        <li className="space-y-3 rounded-3xl border border-rose-100 bg-white/85 p-6 shadow-lg shadow-rose-100/50 backdrop-blur">
          <p className="text-sm font-bold uppercase tracking-wider text-rose-600">Step 3</p>
          <h2 className="text-2xl font-bold">Position and save your first memory</h2>
          <p className="text-sm text-slate-600">
            Pick a subject, upload a photo, and write a diary line. Adjust the text,
            position the diary text directly on the image, then choose “Save to
            Google Photos”. Find the finished image in the selected subject’s
            album.
          </p>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-rose-500 to-fuchsia-500 px-5 py-2 text-sm font-bold text-white shadow-md shadow-rose-200 transition hover:-translate-y-0.5 hover:shadow-lg">
            {connected ? "Continue to your diary" : "Try the diary editor"}
          </Link>
          <p className="text-xs text-slate-500">
            Connect first to load your subjects and albums, then position and save
            a diary for the selected subject. Uploaded images may count toward your Google storage.
          </p>
        </li>
      </ol>
      <p className="rounded-2xl bg-white/60 p-4 text-sm text-slate-600">
        Use the same Google account on each device to load your subjects and their
        albums. You do not need a new album for every diary entry.
      </p>
    </main>
  );
}
