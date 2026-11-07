-- Pay-later links: a traveler lets someone else (a relative, an employer, an agent) pay for a trip without signing in.
-- Only a hash of the secret is stored. One active link per trip; a link ends when it expires, is revoked, or the trip is paid.
create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  uses int not null default 0
);
create index if not exists payment_links_trip_idx on public.payment_links (trip_id);
alter table public.payment_links enable row level security;      -- no policies: only the server (service role) reads and writes it
