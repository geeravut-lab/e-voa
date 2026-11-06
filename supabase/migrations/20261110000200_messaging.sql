-- LINE / WhatsApp notices: which chat account a user linked, and a log (for monthly quotas). Idempotent.
create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('line','whatsapp')),
  address text,                                   -- LINE user id / WhatsApp phone (digits, international)
  status text not null default 'pending' check (status in ('pending','active','stopped')),
  code_hash text,                                 -- keyed hash of the link / verification code (never the code)
  code_expires_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (owner_id, channel)
);
create index if not exists notification_channels_line_idx on public.notification_channels (address) where channel = 'line';
alter table public.notification_channels enable row level security;   -- server only: the hash must never reach a browser

create table if not exists public.message_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  owner_id uuid references auth.users(id) on delete cascade,
  channel text not null,
  kind text,
  status text not null check (status in ('sent','failed')),
  error text
);
create index if not exists message_log_month_idx on public.message_log (channel, at desc);
alter table public.message_log enable row level security;
drop policy if exists message_log_admin on public.message_log;
create policy message_log_admin on public.message_log for select to authenticated using (public.is_admin());
