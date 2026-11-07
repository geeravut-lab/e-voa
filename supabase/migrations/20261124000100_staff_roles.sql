-- Staff roles: what each back-office account may do. The owner (is_owner) may do everything; the other roles are limited to areas (see src/lib/roles.ts).
-- Existing administrators become "manager" (everything except managing staff), so nobody loses access to anything except the staff list.
alter table public.admins add column if not exists role text not null default 'manager';
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('manager', 'operator', 'finance', 'editor'));

-- A change of role is always recorded (the app also records who did it).
create or replace function public.audit_admins_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, detail, source)
  values ((select auth.uid()), 'db', 'admin.role', 'admins', new.user_id::text, jsonb_build_object('from', old.role, 'to', new.role), 'db');
  return null;
end; $$;
drop trigger if exists audit_admins_role on public.admins;
create trigger audit_admins_role after update of role on public.admins for each row when (old.role is distinct from new.role) execute function public.audit_admins_role();

-- Only the owner adds or removes staff (the screen and the server action check it too).
drop function if exists public.grant_admin(text);
create or replace function public.grant_admin(p_email text, p_role text default 'manager') returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not exists (select 1 from public.admins where user_id = (select auth.uid()) and is_owner) then raise exception 'err_forbidden'; end if;
  if p_role not in ('manager', 'operator', 'finance', 'editor') then raise exception 'err_role_invalid'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'err_user_not_found'; end if;
  insert into public.admins (user_id, granted_by, role) values (v_user, (select auth.uid()), p_role)
    on conflict (user_id) do update set role = excluded.role where public.admins.is_owner = false;
end; $$;

create or replace function public.revoke_admin(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins where user_id = (select auth.uid()) and is_owner) then raise exception 'err_forbidden'; end if;
  if p_user = (select auth.uid()) then raise exception 'err_self_revoke'; end if;
  if exists (select 1 from public.admins where user_id = p_user and is_owner) then raise exception 'err_owner_protected'; end if;
  delete from public.admins where user_id = p_user;
end; $$;
revoke all on function public.grant_admin(text, text), public.revoke_admin(uuid) from public, anon;
grant execute on function public.grant_admin(text, text), public.revoke_admin(uuid) to authenticated;
