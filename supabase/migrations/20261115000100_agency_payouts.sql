-- Agency commission payouts: one row per agency and month, written when staff pay the commission out. Idempotent.
create table if not exists public.agency_payouts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  statement_no text not null,
  applications integer not null check (applications >= 0),
  service_fees_thb numeric(12,2) not null,
  commission_pct numeric(5,2) not null,
  commission_thb numeric(12,2) not null,
  paid_at timestamptz not null default now(),
  paid_by uuid references auth.users(id) on delete set null,
  note text,
  unique (agency_id, period)
);
alter table public.agency_payouts enable row level security;
drop policy if exists agency_payouts_read on public.agency_payouts;
create policy agency_payouts_read on public.agency_payouts for select to authenticated using (
  public.is_admin() or exists (select 1 from public.agency_members m where m.agency_id = agency_payouts.agency_id and m.user_id = (select auth.uid())));
