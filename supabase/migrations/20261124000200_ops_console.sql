-- Ops console: who is working on an application, and each staff member's saved queue filters.
alter table public.applications add column if not exists assigned_to uuid references auth.users (id) on delete set null;
alter table public.applications add column if not exists assigned_at timestamptz;
create index if not exists applications_assigned_idx on public.applications (assigned_to) where assigned_to is not null;

create table if not exists public.ops_saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  query jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.ops_saved_filters enable row level security;      -- no policies: only the server (service role) reads and writes, after checking the capability
