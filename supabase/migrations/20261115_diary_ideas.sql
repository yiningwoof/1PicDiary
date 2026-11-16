create table if not exists public.diary_ideas (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  idea_text text not null check (length(trim(idea_text)) > 0),
  used_in_diary_id bigint references public.diaries(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check ((used_at is null and used_in_diary_id is null) or used_at is not null)
);

create index if not exists diary_ideas_subject_unused
  on public.diary_ideas (subject_id, created_at desc) where used_at is null;

alter table public.diary_ideas enable row level security;
grant select, insert, update, delete on table public.diary_ideas to service_role;
revoke all on table public.diary_ideas from anon, authenticated;

comment on table public.diary_ideas is
  'Subject-specific memory notes waiting to be used as diary entry text.';
comment on column public.diary_ideas.id is 'Stable identifier for a saved diary idea.';
comment on column public.diary_ideas.subject_id is 'Subject this memory belongs to; deleting the subject also deletes its ideas.';
comment on column public.diary_ideas.idea_text is 'User-captured memory, quote, milestone, or other possible diary text.';
comment on column public.diary_ideas.used_in_diary_id is 'Diary entry created from this idea; null until the diary is saved.';
comment on column public.diary_ideas.used_at is 'Time this idea was consumed by a successfully recorded diary entry.';
comment on column public.diary_ideas.created_at is 'Time the user captured this memory idea.';
