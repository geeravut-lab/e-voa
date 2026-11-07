-- E-mail notices: each person can switch them off, and staff can see whether mail is getting out (counts and codes only: never an address or a message). Idempotent.
alter table public.profiles add column if not exists email_notices boolean not null default true;
grant update (email_notices) on public.profiles to authenticated;        -- additive: people may change this one extra column of their own row

create table if not exists public.mail_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,
  ok boolean not null,
  code integer
);
create index if not exists mail_log_at_idx on public.mail_log (at desc);
alter table public.mail_log enable row level security;
drop policy if exists mail_log_admin on public.mail_log;
create policy mail_log_admin on public.mail_log for select to authenticated using (public.is_admin());
