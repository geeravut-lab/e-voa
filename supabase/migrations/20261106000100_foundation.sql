-- ThaiPass e-VOA — foundation schema (profiles, admins, settings, audit, analytics, notifications, live sync, SSO links)
-- Run once in Supabase → SQL Editor (or `supabase db push`). Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  lang text not null default 'en' check (lang in ('en','th','zh-CN','hi','ar','ru','ko','ja','zh-TW')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Users may change only these columns (never id/email/created_at).
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, lang) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), ''),
    new.email,
    nullif(coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'), '')
  )
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Back-fill profiles for users that existed before this migration.
insert into public.profiles (id, display_name, email, avatar_url)
select u.id, nullif(coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), ''), u.email,
       nullif(coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'), '')
from auth.users u on conflict (id) do nothing;

-- ---------------------------------------------------------------- admins
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_owner boolean not null default false,
  granted_by uuid,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
-- No insert/update/delete policies: writes happen only through the two functions below or the service role.

create or replace function public.grant_admin(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'err_forbidden'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'err_user_not_found'; end if;
  insert into public.admins (user_id, granted_by) values (v_user, (select auth.uid())) on conflict (user_id) do nothing;
end; $$;

create or replace function public.revoke_admin(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'err_forbidden'; end if;
  if p_user = (select auth.uid()) then raise exception 'err_self_revoke'; end if;
  if exists (select 1 from public.admins where user_id = p_user and is_owner) then raise exception 'err_owner_protected'; end if;
  delete from public.admins where user_id = p_user;
end; $$;
revoke all on function public.grant_admin(text), public.revoke_admin(uuid) from public, anon;
grant execute on function public.grant_admin(text), public.revoke_admin(uuid) to authenticated;

-- ---------------------------------------------------------------- platform settings (brand, feature flags, fees, retention)
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.platform_settings enable row level security;   -- no policies: server (service role) only
insert into public.platform_settings (key, value) values
  ('brand', '{}'),
  ('feature_flags', '{}'),
  ('fees', '{"visa_thb":2000,"regular_service_thb":600,"express_service_thb":2500}'),
  ('retention', '{"document_days":90}')
on conflict (key) do nothing;                                       -- never overwrites what an admin changed

-- ---------------------------------------------------------------- audit trail (append-only)
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_role text,
  action text not null,
  entity text,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  source text not null default 'app'
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
drop policy if exists audit_select_admin on public.audit_log;
create policy audit_select_admin on public.audit_log for select to authenticated using (public.is_admin());

create or replace function public.audit_block_change() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end; $$;
drop trigger if exists audit_no_update on public.audit_log;
create trigger audit_no_update before update or delete on public.audit_log for each row execute function public.audit_block_change();
drop trigger if exists audit_no_truncate on public.audit_log;
create trigger audit_no_truncate before truncate on public.audit_log for each statement execute function public.audit_block_change();

-- Database-level writers: changes to admins are always recorded, even if they bypass the app.
create or replace function public.audit_admins_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail, source)
  values ((select auth.uid()), 'db',
          case tg_op when 'INSERT' then 'admin.grant' else 'admin.revoke' end,
          'admins', coalesce(new.user_id, old.user_id)::text,
          jsonb_build_object('owner', coalesce(new.is_owner, old.is_owner)), 'db');
  return null;
end; $$;
drop trigger if exists audit_admins on public.admins;
create trigger audit_admins after insert or delete on public.admins for each row execute function public.audit_admins_change();

-- ---------------------------------------------------------------- product analytics (events carry no content)
create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  day date not null default ((now() at time zone 'Asia/Bangkok')::date),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null check (name ~ '^[a-z][a-z0-9_.]{1,40}$'),
  tag text check (tag is null or tag ~ '^[a-z0-9_]{1,40}$')
);
create unique index if not exists product_events_active_once on public.product_events (user_id, day) where name = 'active';
create index if not exists product_events_day_idx on public.product_events (day, name);
alter table public.product_events enable row level security;       -- service role writes; admins read via admin_analytics()

create or replace function public.admin_analytics(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'err_forbidden'; end if;
  p_days := least(greatest(coalesce(p_days, 30), 1), 365);
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'active_today', (select count(distinct user_id) from public.product_events where name = 'active' and day = (now() at time zone 'Asia/Bangkok')::date),
    'active_7', (select count(distinct user_id) from public.product_events where name = 'active' and day > (now() at time zone 'Asia/Bangkok')::date - 7),
    'signups_7', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'active', d.n) order by d.day)
                       from (select day, count(distinct user_id) n from public.product_events
                             where name = 'active' and day > (now() at time zone 'Asia/Bangkok')::date - p_days group by day) d), '[]'::jsonb)
  ) into r;
  return r;
end; $$;
revoke all on function public.admin_analytics(int) from public, anon;
grant execute on function public.admin_analytics(int) to authenticated;

-- ---------------------------------------------------------------- in-app notifications
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists app_notifications_dedupe on public.app_notifications (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists app_notifications_user_idx on public.app_notifications (user_id, created_at desc);
alter table public.app_notifications enable row level security;
drop policy if exists notif_select_own on public.app_notifications;
create policy notif_select_own on public.app_notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists notif_update_own on public.app_notifications;
create policy notif_update_own on public.app_notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.app_notifications from authenticated;
grant update (read_at) on public.app_notifications to authenticated;   -- users can only mark as read

-- ---------------------------------------------------------------- Aivora (LINE) SSO links
create table if not exists public.aivora_links (
  aivora_user_id text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.aivora_links enable row level security;          -- service role only

-- ---------------------------------------------------------------- live sync (Realtime "ping", no data inside)
create or replace function public.live_ping(p_topic text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{}'::jsonb, 'ping', p_topic, true);          -- empty payload, private channel
exception when others then null;                                      -- a failed ping must never fail the real write
end; $$;
revoke all on function public.live_ping(text) from public, anon, authenticated;
grant execute on function public.live_ping(text) to service_role;

create or replace function public.live_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform public.live_ping('u:' || new.user_id::text); return null; end; $$;
drop trigger if exists live_app_notifications on public.app_notifications;
create trigger live_app_notifications after insert or update of read_at on public.app_notifications
  for each row execute function public.live_notifications();

do $$
begin
  if to_regclass('realtime.messages') is not null then
    drop policy if exists live_signals_listen on realtime.messages;
    create policy live_signals_listen on realtime.messages for select to authenticated using (
      realtime.messages.extension = 'broadcast' and (
        (select realtime.topic()) = 'u:' || (select auth.uid())::text
        or ((select realtime.topic()) = 'admin' and public.is_admin())
      )
    );
  end if;
end $$;

-- ---------------------------------------------------------------- storage (brand images; private, served through /brand/* routes)
insert into storage.buckets (id, name, public) values ('brand-assets', 'brand-assets', false) on conflict (id) do nothing;
