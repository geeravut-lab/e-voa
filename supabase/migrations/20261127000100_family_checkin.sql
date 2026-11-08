-- Family check-in ("I am safe"). A traveler lists up to 5 people (they must agree by e-mail), checks in, and can ask for a notice to them when a scheduled check-in is missed.
-- Privacy by design: no position is kept except when the traveler ticks "include my position" on an "I need help" check-in (rounded to ~100 m); contacts see a first name, the time and the status.
-- Only the server (service role) reads or writes these tables; contacts have no account and reach their page with a secret link whose HASH is stored.
create table if not exists public.safety_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  email text not null check (char_length(email) between 5 and 160),
  lang text not null default 'en' check (char_length(lang) between 2 and 5),
  token_hash text not null unique,
  invited_at timestamptz not null default now(),
  confirmed_at timestamptz,
  revoked_at timestamptz,
  last_notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists safety_contacts_owner_idx on public.safety_contacts (owner_id);

create table if not exists public.safety_checkins (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  status text not null check (status in ('safe', 'help')),
  lat numeric(8, 3),
  lon numeric(8, 3)
);
create index if not exists safety_checkins_owner_idx on public.safety_checkins (owner_id, at desc);

create table if not exists public.safety_schedule (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  interval_hours int not null default 24 check (interval_hours in (6, 12, 24, 48)),
  grace_hours int not null default 2 check (grace_hours between 1 and 12),
  until_date date,
  next_due_at timestamptz,
  reminded_at timestamptz,
  alerted_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.safety_contacts enable row level security;
alter table public.safety_checkins enable row level security;
alter table public.safety_schedule enable row level security;      -- no policies: nobody reads these from the browser
