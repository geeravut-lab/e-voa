-- Agency (B2B) portal: terms agreed with each agency, who belongs to it, its registration document. Idempotent.
alter table public.agencies add column if not exists contact_name text;
alter table public.agencies add column if not exists contact_email text;
alter table public.agencies add column if not exists contact_phone text;
alter table public.agencies add column if not exists country text;
alter table public.agencies add column if not exists license_no text;
alter table public.agencies add column if not exists discount_thb integer not null default 0 check (discount_thb >= 0);      -- off the service fee of every application
alter table public.agencies add column if not exists commission_pct numeric(5,2) not null default 0 check (commission_pct between 0 and 50);
alter table public.agencies add column if not exists admin_note text;
alter table public.agencies add column if not exists approved_at timestamptz;
alter table public.agencies add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'agent' check (role in ('owner','agent')),
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index if not exists agency_members_user_idx on public.agency_members (user_id);
alter table public.agency_members enable row level security;
drop policy if exists agency_members_read on public.agency_members;
create policy agency_members_read on public.agency_members for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

alter table public.documents add column if not exists agency_id uuid references public.agencies(id) on delete cascade;     -- an agency's registration document
create or replace function public.documents_due_for_purge(p_days integer, p_limit integer default 200)
returns table (id uuid, storage_path text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.storage_path
  from public.documents d
  left join public.applications a on a.id = d.application_id
  left join public.trips t on t.id = a.trip_id
  where d.deleted_at is null
    and ( (t.arrival_date is not null and t.arrival_date + greatest(p_days, 1) < (now() at time zone 'Asia/Bangkok')::date)
       or (d.application_id is null and d.agency_id is null and d.created_at < now() - interval '7 days') )
  order by d.created_at
  limit greatest(least(p_limit, 1000), 1);
$$;
revoke all on function public.documents_due_for_purge(integer, integer) from public, anon, authenticated;
grant execute on function public.documents_due_for_purge(integer, integer) to service_role;
