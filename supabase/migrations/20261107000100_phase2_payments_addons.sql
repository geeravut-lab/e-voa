-- ThaiPass e-VOA — Phase 2/3: payments (receipts, refunds), add-on orders, partner packages, Ops notes. Idempotent.

-- ---------------------------------------------------------------- payments: receipt, items snapshot, provider references
alter table public.payments add column if not exists receipt_no text;
alter table public.payments add column if not exists items jsonb not null default '[]'::jsonb;        -- what was bought, frozen at checkout (see lib/pricing.ts)
alter table public.payments add column if not exists provider_payment_ref text;                       -- Stripe payment_intent id (needed to refund)
alter table public.payments add column if not exists trip_id uuid references public.trips(id);
alter table public.payments add column if not exists expires_at timestamptz;
create unique index if not exists payments_receipt_uq on public.payments (receipt_no) where receipt_no is not null;
create sequence if not exists public.receipt_seq;

-- Marks a payment as paid exactly once and gives it a receipt number. Returns the row, or nothing when it was already paid
-- (so a repeated webhook or a return-page check cannot run the "after payment" work twice).
create or replace function public.mark_payment_paid(p_id uuid, p_intent text)
returns public.payments
language plpgsql security definer set search_path = '' as $$
declare r public.payments;
begin
  update public.payments set
      status = 'paid',
      paid_at = now(),
      provider_payment_ref = coalesce(p_intent, provider_payment_ref),
      receipt_no = 'RC-' || to_char((now() at time zone 'Asia/Bangkok'), 'YY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0')
    where id = p_id and status = 'pending'
    returning * into r;
  return r;                                  -- null row when nothing matched
end; $$;
revoke all on function public.mark_payment_paid(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_payment_paid(uuid, text) to service_role;

-- ---------------------------------------------------------------- refunds
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  addon_order_id uuid,
  amount_thb numeric(12,2) not null check (amount_thb > 0),
  kind text not null check (kind in ('addon','exception')),   -- 'addon' = policy refund of an unused add-on; 'exception' = decided by staff
  reason text,
  provider_refund_id text,
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists refunds_payment_idx on public.refunds (payment_id);
alter table public.refunds enable row level security;
drop policy if exists refunds_read on public.refunds;
create policy refunds_read on public.refunds for select to authenticated using (
  public.is_admin() or exists (select 1 from public.payments p where p.id = payment_id and p.owner_id = (select auth.uid())));

-- ---------------------------------------------------------------- partner packages (a local copy of what partners sell)
create table if not exists public.partner_packages (
  provider text not null check (provider in ('insurance','sim','vip','bhs')),
  package_code text not null,
  category text not null check (category in ('insurance','sim','esim','vip','health')),
  name text not null,
  detail text,
  price_thb numeric(12,2) not null check (price_thb >= 0),
  price_usd numeric(12,2),
  price_cny numeric(12,2),
  terms text,
  ref_link text,
  image text,
  active boolean not null default true,
  synced_at timestamptz not null default now(),
  primary key (provider, package_code)
);
alter table public.partner_packages enable row level security;
drop policy if exists partner_packages_read on public.partner_packages;
create policy partner_packages_read on public.partner_packages for select to anon, authenticated using (active);

-- ---------------------------------------------------------------- add-on orders (insurance, SIM, eSIM, VIP, Beauty & Health)
create table if not exists public.addon_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  payment_id uuid references public.payments(id),
  category text not null check (category in ('insurance','sim','esim','vip','health')),
  package_code text not null,
  package_name text not null,
  price_thb numeric(12,2) not null check (price_thb >= 0),
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','issuing','issued','used','failed','refunded','cancelled')),
  request_ref text not null unique,                    -- OUR id sent to the partner: the same order is never bought twice
  partner_ref jsonb not null default '{}'::jsonb,      -- policy_no, TransactionID, voucherCode …
  delivery jsonb not null default '{}'::jsonb,         -- e-card url, eSIM LPA / QR, voucher url …
  last_error text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  refunded_thb numeric(12,2) not null default 0 check (refunded_thb >= 0),
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  used_at timestamptz
);
create index if not exists addon_orders_app_idx on public.addon_orders (application_id);
create index if not exists addon_orders_due_idx on public.addon_orders (status, next_attempt_at);
alter table public.addon_orders enable row level security;
drop policy if exists addon_orders_read on public.addon_orders;
create policy addon_orders_read on public.addon_orders for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());

create or replace function public.live_addon_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform public.live_ping('u:' || new.owner_id::text); return null; end; $$;
drop trigger if exists live_addon_orders on public.addon_orders;
create trigger live_addon_orders after update of status on public.addon_orders
  for each row when (old.status is distinct from new.status) execute function public.live_addon_status();

-- ---------------------------------------------------------------- Ops notes (staff only; never shown to travelers)
create table if not exists public.application_notes (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.application_notes enable row level security;
drop policy if exists notes_admin on public.application_notes;
create policy notes_admin on public.application_notes for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- settings defaults (never overwrite what an admin changed)
insert into public.platform_settings (key, value) values
  ('eligibility', '{"voa":[],"visa_free":[]}'),
  ('required_documents', '["passport_bio","photo","return_ticket","accommodation","funds","insurance"]'),
  ('addon_rules', '{"sim_airports":[1],"sim_blocked_for_express":true,"vip_airports":[1],"vip_blocked_for_express":true}'),
  ('insurance', '{"plan_code":"GTA0501","name":"Travel accident and medical cover (up to USD 50,000)","price_thb":290,"price_usd":8,"price_cny":58}'),
  ('refund_policy', '{"visa_fee_refundable":false,"service_fee_refundable":false,"unused_addons_refundable":true}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- queue counts (admin dashboard + live fingerprint)
create or replace function public.admin_ops_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'err_forbidden'; end if;
  return jsonb_build_object(
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.applications group by status) s), '{}'::jsonb),
    'sla_at_risk', (select count(*) from public.applications where status in ('paid','pre_check','submitted','under_review','action_required') and sla_due_at is not null and sla_due_at < now() + interval '6 hours'),
    'sla_overdue', (select count(*) from public.applications where status in ('paid','pre_check','submitted','under_review','action_required') and sla_due_at is not null and sla_due_at < now()),
    'addons_failed', (select count(*) from public.addon_orders where status = 'failed'),
    'revenue_thb_today', coalesce((select sum(amount_thb - refunded_thb) from public.payments where status in ('paid','partially_refunded') and paid_at >= date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'), 0)
  );
end; $$;
revoke all on function public.admin_ops_summary() from public, anon;
grant execute on function public.admin_ops_summary() to authenticated;
