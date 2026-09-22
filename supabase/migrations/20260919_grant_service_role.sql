-- Apply this once to projects created before the explicit grants were added to
-- schema.sql. It is safe to run repeatedly.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.subjects to service_role;
grant select, insert, update, delete on table public.diaries to service_role;
grant usage, select on sequence public.diaries_id_seq to service_role;

-- Supabase access remains server-only. The browser roles have no table access.
revoke all on table public.subjects from anon, authenticated;
revoke all on table public.diaries from anon, authenticated;
revoke all on sequence public.diaries_id_seq from anon, authenticated;
