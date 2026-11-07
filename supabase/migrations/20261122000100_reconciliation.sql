-- Daily reconciliation of our payments against Stripe: one row per Thai calendar day. Idempotent.
create table if not exists public.reconciliation_reports (
  day date primary key,
  status text not null check (status in ('ok','issues','error','skipped')),
  stripe_gross_thb integer not null default 0,
  ours_gross_thb integer not null default 0,
  stripe_refunds_thb integer not null default 0,
  ours_refunds_thb integer not null default 0,
  stripe_count integer not null default 0,
  ours_count integer not null default 0,
  issues jsonb not null default '[]'::jsonb,
  error text,
  run_at timestamptz not null default now(),
  reviewed_at timestamptz,                                  -- staff looked at the differences
  reviewed_by uuid references auth.users(id) on delete set null
);
alter table public.reconciliation_reports enable row level security;
drop policy if exists reconciliation_reports_admin on public.reconciliation_reports;
create policy reconciliation_reports_admin on public.reconciliation_reports for select to authenticated using (public.is_admin());
