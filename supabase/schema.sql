create table if not exists diaries (
  id bigint generated always as identity primary key,
  child_name text not null,
  diary_text text not null,
  text_position text not null check (text_position in ('top', 'middle', 'bottom')),
  album_title text not null,
  google_media_item_id text,
  storage_path text,
  created_at timestamptz not null default now()
);
