-- Which back-office alerts each administrator has already opened. An alert comes back (unseen again) when its signature changes (a new error, a higher count). Idempotent.
create table if not exists public.admin_alert_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  signature text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.admin_alert_seen enable row level security;
drop policy if exists admin_alert_seen_own on public.admin_alert_seen;
create policy admin_alert_seen_own on public.admin_alert_seen for select to authenticated using (user_id = (select auth.uid()) and public.is_admin());
