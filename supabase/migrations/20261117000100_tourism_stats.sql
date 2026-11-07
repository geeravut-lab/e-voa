-- Government / TAT dashboard: anonymous tourism statistics for a read-only audience. Idempotent.
-- report_viewers = accounts (e.g. a TAT officer) that may open the statistics page but nothing else.
create table if not exists public.report_viewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.report_viewers enable row level security;
drop policy if exists report_viewers_read on public.report_viewers;
create policy report_viewers_read on public.report_viewers for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

-- Counts only: no names, no passport data, nothing that identifies a person. Called by the server (service role) after it checked who is asking.
-- "Arrivals" are applications that are approved or used, by ARRIVAL date in the range; the funnel counts everything paid or later.
create or replace function public.tourism_stats(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
with base as (
  select a.status, a.package, a.submitted_at, a.decided_at, a.created_at,
         t.arrival_date, t.arrival_airport_id, t.departure_date, t.purpose_id,
         tr.nationality_id, tr.gender_id, tr.date_of_birth
  from public.applications a
  join public.trips t on t.id = a.trip_id
  join public.travelers tr on tr.id = a.traveler_id
  where t.arrival_date between p_from and p_to
    and a.status in ('paid','pre_check','action_required','submitted','submission_failed','under_review','approved','rejected','used','no_show')
), appr as (select * from base where status in ('approved','used'))
select jsonb_build_object(
  'funnel',      (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from base group by 1) s),
  'daily',       (select coalesce(jsonb_agg(jsonb_build_object('k', d, 'n', n) order by d), '[]'::jsonb) from (select arrival_date::text d, count(*) n from appr group by 1) s),
  'nationality', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (select nationality_id::text k, count(*) n from appr group by 1) s),
  'airport',     (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (select arrival_airport_id::text k, count(*) n from appr group by 1) s),
  'purpose',     (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (select purpose_id::text k, count(*) n from appr group by 1) s),
  'gender',      (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (select gender_id::text k, count(*) n from appr group by 1) s),
  'age',         (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by k), '[]'::jsonb) from (
                   select case when date_of_birth is null then 'unknown'
                               when extract(year from age(arrival_date, date_of_birth)) < 18 then '0-17'
                               when extract(year from age(arrival_date, date_of_birth)) < 30 then '18-29'
                               when extract(year from age(arrival_date, date_of_birth)) < 45 then '30-44'
                               when extract(year from age(arrival_date, date_of_birth)) < 60 then '45-59'
                               else '60+' end k, count(*) n from appr group by 1) s),
  'stay',        (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by k), '[]'::jsonb) from (
                   select case when departure_date is null then 'unknown'
                               when departure_date - arrival_date <= 3 then '1-3'
                               when departure_date - arrival_date <= 7 then '4-7'
                               when departure_date - arrival_date <= 14 then '8-14'
                               when departure_date - arrival_date <= 30 then '15-30'
                               else '31+' end k, count(*) n from appr group by 1) s),
  'package',     (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (select package k, count(*) n from appr group by 1) s),
  'avg_decision_hours', (select round((avg(extract(epoch from (decided_at - submitted_at))) / 3600)::numeric, 1) from appr where decided_at is not null and submitted_at is not null and decided_at >= submitted_at),
  'avg_lead_days',      (select round(avg(arrival_date - (created_at at time zone 'Asia/Bangkok')::date)::numeric, 1) from appr)
);
$$;
revoke all on function public.tourism_stats(date, date) from public, anon, authenticated;
grant execute on function public.tourism_stats(date, date) to service_role;
