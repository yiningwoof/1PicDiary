-- Allow an explicitly confirmed subject deletion to remove its diary metadata
-- atomically. Google Photos albums and media are external and remain untouched.
alter table public.diaries
  drop constraint if exists diaries_subject_id_fkey;

alter table public.diaries
  add constraint diaries_subject_id_fkey
  foreign key (subject_id)
  references public.subjects(id)
  on delete cascade;
