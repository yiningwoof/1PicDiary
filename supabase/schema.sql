-- Initial schema for a new database. Create subjects before their diary entries.
-- Subject profiles belong to the verified Google account.
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  google_owner_id text not null,
  name text not null check (length(trim(name)) between 1 and 80),
  diary_album_title text not null check (length(trim(diary_album_title)) between 1 and 200),
  google_diary_album_id text not null,
  save_originals boolean not null default true,
  originals_album_title text,
  google_originals_album_id text,
  check (
    (save_originals and originals_album_title is not null and google_originals_album_id is not null and google_originals_album_id <> google_diary_album_id)
    or (not save_originals and originals_album_title is null and google_originals_album_id is null)
  ),
  created_at timestamptz not null default now(),
  unique (google_owner_id, google_diary_album_id),
  unique (google_owner_id, google_originals_album_id)
);

create unique index if not exists subjects_owner_name
  on public.subjects (google_owner_id, lower(name));
create unique index if not exists subjects_owner_diary_album_title
  on public.subjects (google_owner_id, lower(diary_album_title));

create table if not exists public.diaries (
  id bigint generated always as identity primary key,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  diary_date date not null,
  diary_text text not null,
  text_layout jsonb not null check (jsonb_typeof(text_layout) = 'object' and text_layout ? 'version' and text_layout->>'version' = '1'),
  google_media_item_id text not null,
  google_original_media_item_id text,
  created_at timestamptz not null default now()
);

create index if not exists diaries_subject_date
  on public.diaries (subject_id, diary_date);

-- Only the server service role accesses records. Authorize diary access through
-- the related subject's google_owner_id; never trust a browser-supplied owner.
alter table public.subjects enable row level security;
alter table public.diaries enable row level security;

-- New tables are not automatically exposed to Data API roles. Only the
-- trusted server role receives table privileges; browsers receive none.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.subjects to service_role;
grant select, insert, update, delete on table public.diaries to service_role;
grant usage, select on sequence public.diaries_id_seq to service_role;
revoke all on table public.subjects from anon, authenticated;
revoke all on table public.diaries from anon, authenticated;
revoke all on sequence public.diaries_id_seq from anon, authenticated;

comment on table public.subjects is
  'A person, relationship, pet, or other entity that has its own diary and Google Photos albums.';
comment on column public.subjects.id is
  'Stable application-generated identifier referenced by diary entries.';
comment on column public.subjects.google_owner_id is
  'Immutable Google account subject ID from the verified OAuth userinfo response; scopes every subject to its owner.';
comment on column public.subjects.name is
  'User-facing name of the diary subject, such as Luna or Our marriage.';
comment on column public.subjects.diary_album_title is
  'Human-readable Google Photos album name for finished images containing diary text.';
comment on column public.subjects.google_diary_album_id is
  'Google Photos identifier used as the upload destination for finished diary images.';
comment on column public.subjects.save_originals is
  'Whether an unchanged copy of each uploaded photo is also saved to a separate Google Photos album.';
comment on column public.subjects.originals_album_title is
  'Human-readable Google Photos album name for unchanged original photos; null when save_originals is false.';
comment on column public.subjects.google_originals_album_id is
  'Google Photos identifier used as the upload destination for unchanged originals; null when save_originals is false.';
comment on column public.subjects.created_at is
  'Timestamp when this subject configuration was created.';

comment on table public.diaries is
  'One diary entry for a subject; photo bytes remain in Google Photos and only metadata is stored here.';
comment on column public.diaries.id is
  'Database-generated identifier for the diary entry.';
comment on column public.diaries.subject_id is
  'Subject that owns this diary entry; references subjects.id.';
comment on column public.diaries.diary_date is
  'Calendar day the memory happened, independent of when the record was created.';
comment on column public.diaries.diary_text is
  'Text written by the user for this diary entry.';
comment on column public.diaries.text_layout is
  'Versioned JSON object containing normalized text box coordinates, font styling, and resolved render metadata.';
comment on column public.diaries.google_media_item_id is
  'Google Photos media item ID for the finished image containing diary text.';
comment on column public.diaries.google_original_media_item_id is
  'Google Photos media item ID for the unchanged original photo; null when originals are disabled or its upload failed.';
comment on column public.diaries.created_at is
  'Timestamp when this database record was created.';
