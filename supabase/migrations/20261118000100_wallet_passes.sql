-- Wallet passes that were handed out (Google "Save to Wallet" link, Apple .pkpass) and the phones that registered for updates.
-- Written and read by the server only (service role); no policy means no browser access. Idempotent.
create table if not exists public.wallet_passes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  platform text not null check (platform in ('google','apple')),
  serial text not null,                                 -- Google: object id; Apple: serial number
  auth_token text,                                      -- Apple only: the secret a phone sends with every request about this pass
  lang text not null default 'en',
  fingerprint text not null,                            -- hash of what the pass shows; a change means the pass must be updated
  updated_at timestamptz not null default now(),        -- Apple "last updated" tag
  synced_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  unique (application_id, platform),
  unique (platform, serial)
);
alter table public.wallet_passes enable row level security;
create index if not exists wallet_passes_sync_idx on public.wallet_passes (synced_at);

create table if not exists public.wallet_registrations (
  device_id text not null,
  pass_id uuid not null references public.wallet_passes(id) on delete cascade,
  push_token text not null,
  created_at timestamptz not null default now(),
  primary key (device_id, pass_id)
);
alter table public.wallet_registrations enable row level security;
