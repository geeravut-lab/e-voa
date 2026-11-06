-- ThaiPass e-VOA — closing items: rate limits, error log, consents, declarations (+signature), form drafts, upgrades. Idempotent.

-- ---------------------------------------------------------------- rate limiting (fixed window per key; the server asks, the database counts atomically)
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.rate_limits enable row level security;          -- server only: no policy
create or replace function public.rate_limit_hit(p_key text, p_window_s integer, p_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare h integer;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_s) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_s) then now() else r.window_start end
  returning hits into h;
  return h <= p_limit;
end; $$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------- error log (our own, no third party; no personal data is written)
create table if not exists public.error_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  route text,
  kind text,
  message text not null,
  digest text
);
create index if not exists error_log_at_idx on public.error_log (at desc);
alter table public.error_log enable row level security;
drop policy if exists error_log_admin on public.error_log;
create policy error_log_admin on public.error_log for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- consents (PDPA/GDPR): who accepted which text, when
create table if not exists public.consents (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  kind text not null check (kind in ('privacy','terms','immigration_share','partner_share')),
  version text not null,
  accepted_at timestamptz not null default now()
);
create index if not exists consents_owner_idx on public.consents (owner_id, accepted_at desc);
alter table public.consents enable row level security;
drop policy if exists consents_read on public.consents;
create policy consents_read on public.consents for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------- declaration + signature (one per application)
alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents add constraint documents_kind_check check (kind in ('passport_bio','photo','return_ticket','accommodation','funds','insurance','additional','evoa','other','signature'));
create table if not exists public.declarations (
  application_id uuid primary key references public.applications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  signer_name text not null check (char_length(signer_name) between 2 and 120),
  version text not null,
  signature_document_id uuid references public.documents(id) on delete set null,
  signed_at timestamptz not null default now()
);
alter table public.declarations enable row level security;
drop policy if exists declarations_read on public.declarations;
create policy declarations_read on public.declarations for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------- autosave of the traveler form (encrypted by the server, readable only by the server)
create table if not exists public.form_drafts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  slot text not null,
  data_enc text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, trip_id, slot)
);
alter table public.form_drafts enable row level security;          -- server only

-- ---------------------------------------------------------------- upgrades (Regular → Express by paying the difference)
alter table public.payments add column if not exists kind text not null default 'order' check (kind in ('order','upgrade'));
alter table public.payments add column if not exists upgrade_application_id uuid references public.applications(id) on delete cascade;
alter table public.applications add column if not exists upgraded_at timestamptz;
