create table if not exists public.google_sessions (
  id uuid primary key,
  google_owner_id text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz not null,
  session_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists google_sessions_owner on public.google_sessions (google_owner_id);
create index if not exists google_sessions_expiry on public.google_sessions (session_expires_at);
alter table public.google_sessions enable row level security;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.google_sessions to service_role;
revoke all on table public.google_sessions from anon, authenticated;

comment on table public.google_sessions is 'Server-managed Google OAuth sessions. Browsers receive only the random session ID; token values remain encrypted at rest.';
comment on column public.google_sessions.id is 'Random opaque session ID stored in the browser HttpOnly cookie.';
comment on column public.google_sessions.google_owner_id is 'Immutable Google account subject ID verified when OAuth completes.';
comment on column public.google_sessions.access_token_ciphertext is 'Current Google access token encrypted by the application with AES-256-GCM.';
comment on column public.google_sessions.refresh_token_ciphertext is 'Google refresh token encrypted by the application with AES-256-GCM; used to renew expired access tokens.';
comment on column public.google_sessions.access_token_expires_at is 'Time after which the server must refresh the short-lived Google access token.';
comment on column public.google_sessions.session_expires_at is 'Absolute expiration for this application session, currently 90 days after connection.';
comment on column public.google_sessions.created_at is 'Timestamp when the Google connection was saved.';
comment on column public.google_sessions.last_used_at is 'Timestamp of the most recent access-token refresh for operational cleanup.';
