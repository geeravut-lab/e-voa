-- ThaiPass e-VOA — Phase 1 core schema: master data, travelers, trips, applications (state machine in the database),
-- documents, payments, status history, Immigration outbox, agencies. Idempotent: safe to run again.
-- Rules this file enforces (see docs/evoa/07-DATA-MODEL.md):
--   * an application's status can only change through public.transition_application(), which checks the allowed moves and writes history
--   * users read their own rows; every other write goes through the server (service role) after it checked who is asking
--   * personal documents live in a private bucket; passport numbers are stored encrypted (+ a keyed hash for duplicate checks)

-- ---------------------------------------------------------------- shared helpers
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

-- ---------------------------------------------------------------- master data (reference lists synced from Immigration)
create table if not exists public.master_data (
  name text not null,                     -- salutation, gender, nationality, arrivalAirport, city, district, subDistrict, documentList …
  id integer not null,                    -- Immigration's id: this is what gets sent back in an application
  parent_id integer,                      -- district → city id, subDistrict → district id
  label text not null,
  sequence integer not null default 0,
  extra jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (name, id)
);
create index if not exists master_data_parent_idx on public.master_data (name, parent_id);
alter table public.master_data enable row level security;
drop policy if exists master_data_read on public.master_data;
create policy master_data_read on public.master_data for select to anon, authenticated using (true);   -- public reference data

create table if not exists public.master_sync (
  name text primary key,
  last_synced_at timestamptz,
  row_count integer not null default 0,
  last_error text
);
alter table public.master_sync enable row level security;
drop policy if exists master_sync_admin on public.master_sync;
create policy master_sync_admin on public.master_sync for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- agencies (data model ready; portal comes later)
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now()
);
alter table public.agencies enable row level security;
drop policy if exists agencies_admin on public.agencies;
create policy agencies_admin on public.agencies for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- travelers (one row per person; reusable across trips)
create table if not exists public.travelers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  relation text not null default 'self' check (relation in ('self','family','friend','client')),
  given_name text not null check (char_length(given_name) between 1 and 255),
  middle_name text,
  surname text not null check (char_length(surname) between 1 and 255),
  gender_id integer,
  salutation_id integer,
  date_of_birth date,
  nationality_id integer,
  passport_no_enc text,                   -- AES-256-GCM, written by the server (lib/crypto.ts)
  passport_no_hash text,                  -- keyed hash: finds duplicates without decrypting
  passport_last4 text check (passport_last4 is null or char_length(passport_last4) <= 4),
  passport_issue_date date,
  passport_expiry_date date,
  passport_place_of_issue text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists travelers_owner_idx on public.travelers (owner_id);
create unique index if not exists travelers_owner_passport_uq on public.travelers (owner_id, passport_no_hash) where passport_no_hash is not null;
drop trigger if exists travelers_touch on public.travelers;
create trigger travelers_touch before update on public.travelers for each row execute function public.touch_updated_at();
alter table public.travelers enable row level security;
drop policy if exists travelers_owner on public.travelers;
create policy travelers_owner on public.travelers for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists travelers_admin_read on public.travelers;
create policy travelers_admin_read on public.travelers for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- trips (the flight; a group of travelers shares one trip)
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id),
  arrival_airport_id integer,
  arrival_date date not null,
  arrival_time text check (arrival_time is null or arrival_time ~ '^\d{2}:\d{2}$'),
  arrival_flight_no text,
  arrival_airline_id integer,
  arrival_pnr text,
  departure_date date,
  departure_time text check (departure_time is null or departure_time ~ '^\d{2}:\d{2}$'),
  departure_flight_no text,
  departure_airline_id integer,
  departure_pnr text,
  purpose_id integer,
  boarded_country_id integer,
  next_city text,
  type_of_flight_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (departure_date is null or departure_date >= arrival_date)
);
create index if not exists trips_owner_idx on public.trips (owner_id);
create index if not exists trips_arrival_idx on public.trips (arrival_date);
drop trigger if exists trips_touch on public.trips;
create trigger trips_touch before update on public.trips for each row execute function public.touch_updated_at();
alter table public.trips enable row level security;
drop policy if exists trips_owner on public.trips;
create policy trips_owner on public.trips for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists trips_admin_read on public.trips;
create policy trips_admin_read on public.trips for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount_thb numeric(12,2) not null check (amount_thb >= 0),
  provider text not null check (provider in ('stripe','local','manual')),
  provider_ref text,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','partially_refunded')),
  refunded_thb numeric(12,2) not null default 0 check (refunded_thb >= 0),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (refunded_thb <= amount_thb)
);
create unique index if not exists payments_provider_ref_uq on public.payments (provider, provider_ref) where provider_ref is not null;
create index if not exists payments_owner_idx on public.payments (owner_id);
alter table public.payments enable row level security;
drop policy if exists payments_owner_read on public.payments;
create policy payments_owner_read on public.payments for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
-- no insert/update policy: only the server (after the gateway confirmed) may record a payment

create table if not exists public.payment_events (       -- webhook de-duplication: the same provider event is handled once
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  type text,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);
alter table public.payment_events enable row level security;   -- server only

-- ---------------------------------------------------------------- applications
create sequence if not exists public.application_ref_seq;
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  ref_no text not null unique default ('EV-' || to_char((now() at time zone 'Asia/Bangkok'), 'YY') || '-' || lpad(nextval('public.application_ref_seq')::text, 6, '0')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id),
  trip_id uuid not null references public.trips(id),
  traveler_id uuid not null references public.travelers(id),
  package text not null check (package in ('regular','express')),
  status text not null default 'draft' check (status in (
    'draft','awaiting_payment','expired','paid','pre_check','action_required','submitted','submission_failed','under_review','approved','rejected','cancelled','used','no_show')),
  status_reason text,
  form jsonb not null default '{}'::jsonb,                 -- the remaining Immigration fields (accommodation, occupation, income …)
  visa_fee_thb integer not null check (visa_fee_thb >= 0), -- price snapshot at the time of ordering
  service_fee_thb integer not null check (service_fee_thb >= 0),
  payment_id uuid references public.payments(id),
  batch_reference text,                                    -- our group id sent to Immigration
  payment_receipt_ref text unique,                         -- our per-person id sent to Immigration
  immigration_ref text unique,                             -- webReferenceNumber returned by Immigration
  submitted_at timestamptz,
  decided_at timestamptz,
  sla_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_owner_idx on public.applications (owner_id, created_at desc);
create index if not exists applications_status_idx on public.applications (status, sla_due_at);
create index if not exists applications_trip_idx on public.applications (trip_id);
alter table public.applications enable row level security;
drop policy if exists applications_read on public.applications;
create policy applications_read on public.applications for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
-- no insert/update/delete policy for users: the server creates and moves applications

create or replace function public.applications_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'err_status_locked: new applications start as draft'; end if;
    return new;
  end if;
  if new.status is distinct from old.status and coalesce(current_setting('app.in_transition', true), '') <> '1' then
    raise exception 'err_status_locked: use transition_application()';
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists applications_guard_trg on public.applications;
create trigger applications_guard_trg before insert or update on public.applications for each row execute function public.applications_guard();

create table if not exists public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  actor_id uuid,
  source text not null check (source in ('user','ops','immigration','payment','system')),
  at timestamptz not null default now()
);
create index if not exists status_history_app_idx on public.application_status_history (application_id, at);
alter table public.application_status_history enable row level security;
drop policy if exists status_history_read on public.application_status_history;
create policy status_history_read on public.application_status_history for select to authenticated using (
  public.is_admin() or exists (select 1 from public.applications a where a.id = application_id and a.owner_id = (select auth.uid())));
create or replace function public.history_no_update() returns trigger language plpgsql as $$
begin raise exception 'application_status_history is append-only'; end; $$;
drop trigger if exists history_no_update_trg on public.application_status_history;
create trigger history_no_update_trg before update on public.application_status_history for each row execute function public.history_no_update();

-- Allowed moves. Keep identical to src/lib/applications/state.ts (a test compares the two against this database).
create or replace function public.application_transition_ok(p_from text, p_to text) returns boolean
language sql immutable as $$
  select (p_from, p_to) in (
    ('draft','awaiting_payment'), ('draft','cancelled'), ('draft','expired'),
    ('awaiting_payment','paid'), ('awaiting_payment','expired'), ('awaiting_payment','cancelled'),
    ('paid','pre_check'), ('paid','cancelled'),
    ('pre_check','submitted'), ('pre_check','submission_failed'), ('pre_check','action_required'), ('pre_check','cancelled'),
    ('action_required','pre_check'), ('action_required','submitted'), ('action_required','under_review'), ('action_required','cancelled'),
    ('submitted','under_review'), ('submitted','submission_failed'), ('submitted','approved'), ('submitted','rejected'), ('submitted','action_required'),
    ('submission_failed','submitted'), ('submission_failed','pre_check'), ('submission_failed','cancelled'),
    ('under_review','approved'), ('under_review','rejected'), ('under_review','action_required'),
    ('approved','used'), ('approved','no_show')
  );
$$;

drop function if exists public.transition_application(uuid, text, text, text, uuid);
create or replace function public.transition_application(
  p_id uuid, p_to text, p_reason text default null, p_source text default 'system', p_actor uuid default null, p_only_from text[] default null
) returns public.applications
language plpgsql security definer set search_path = '' as $$
declare cur public.applications; prev text;
begin
  select * into cur from public.applications where id = p_id for update;
  if not found then raise exception 'err_not_found'; end if;
  if cur.status = p_to then return cur; end if;                      -- repeated callbacks are harmless
  -- Compare-and-set: "only move if it is still in one of these states". A slower writer then cannot undo a decision that arrived first.
  if p_only_from is not null and not (cur.status = any (p_only_from)) then return cur; end if;
  if not public.application_transition_ok(cur.status, p_to) then
    raise exception 'err_bad_transition: % -> %', cur.status, p_to;
  end if;
  prev := cur.status;
  perform set_config('app.in_transition', '1', true);
  update public.applications set
      status = p_to,
      status_reason = p_reason,
      decided_at = case when p_to in ('approved','rejected') then now() else decided_at end,
      submitted_at = case when p_to = 'submitted' and submitted_at is null then now() else submitted_at end,
      sla_due_at = case when p_to = 'paid' then now() + (case package when 'express' then interval '24 hours' else interval '72 hours' end) else sla_due_at end
    where id = p_id returning * into cur;
  insert into public.application_status_history (application_id, from_status, to_status, reason, actor_id, source)
    values (p_id, prev, p_to, p_reason, p_actor, p_source);
  return cur;
end; $$;
revoke all on function public.transition_application(uuid, text, text, text, uuid, text[]) from public, anon, authenticated;
grant execute on function public.transition_application(uuid, text, text, text, uuid, text[]) to service_role;

-- Live sync: wake the owner's open pages and the admins' pages whenever a status changes.
create or replace function public.live_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.live_ping('u:' || new.owner_id::text);
  perform public.live_ping('admin');
  return null;
end; $$;
drop trigger if exists live_applications_status on public.applications;
create trigger live_applications_status after update of status on public.applications
  for each row when (old.status is distinct from new.status) execute function public.live_application_status();

-- Counts for the admin live fingerprint and dashboard.
create or replace function public.admin_queue_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'err_forbidden'; end if;
  return coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.applications group by status) s), '{}'::jsonb);
end; $$;
revoke all on function public.admin_queue_counts() from public, anon;
grant execute on function public.admin_queue_counts() to authenticated;

-- ---------------------------------------------------------------- documents (files are in the private "documents" bucket, encrypted by the server)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  traveler_id uuid references public.travelers(id) on delete set null,
  kind text not null check (kind in ('passport_bio','photo','return_ticket','accommodation','funds','insurance','additional','evoa','other')),
  doc_list_id integer,                                     -- Immigration's document id
  storage_path text not null unique,
  mime text not null,
  size_bytes integer not null check (size_bytes >= 0),     -- size of the ORIGINAL file
  sha256 text,                                             -- of the original, to detect duplicates and corruption
  enc_version smallint not null default 1,
  review text not null default 'uploaded' check (review in ('uploaded','accepted','rejected')),
  review_reason text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists documents_app_idx on public.documents (application_id);
create index if not exists documents_owner_idx on public.documents (owner_id);
alter table public.documents enable row level security;
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated
  using ((owner_id = (select auth.uid()) or public.is_admin()) and deleted_at is null);
insert into storage.buckets (id, name, public, file_size_limit) values ('documents', 'documents', false, 5242880) on conflict (id) do nothing;

-- Which files may be removed now? Terminal-or-past trips older than the retention window; loose uploads older than 7 days.
create or replace function public.documents_due_for_purge(p_days integer, p_limit integer default 200)
returns table (id uuid, storage_path text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.storage_path
  from public.documents d
  left join public.applications a on a.id = d.application_id
  left join public.trips t on t.id = a.trip_id
  where d.deleted_at is null
    and ( (t.arrival_date is not null and t.arrival_date + greatest(p_days, 1) < (now() at time zone 'Asia/Bangkok')::date)
       or (d.application_id is null and d.created_at < now() - interval '7 days') )
  order by d.created_at
  limit greatest(least(p_limit, 1000), 1);
$$;
revoke all on function public.documents_due_for_purge(integer, integer) from public, anon, authenticated;
grant execute on function public.documents_due_for_purge(integer, integer) to service_role;

-- ---------------------------------------------------------------- Immigration outbox (queue with retry; server only)
create table if not exists public.immigration_outbox (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  kind text not null check (kind in ('docket','additional_documents')),
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists outbox_due_idx on public.immigration_outbox (status, next_attempt_at);
alter table public.immigration_outbox enable row level security;   -- server only
