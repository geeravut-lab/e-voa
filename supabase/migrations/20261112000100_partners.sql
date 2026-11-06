-- Partner portal: companies that sell their own services (SIM, VIP, health …) through ThaiPass without an API.
-- A portal-managed partner lists its packages here, ThaiPass sells them, the traveler gets a voucher code, the partner redeems the code,
-- and the month is settled from the redeemed orders. Idempotent.
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  provider text not null check (provider in ('sim','vip','bhs','insurance')),      -- which kind of service it sells (decides the categories it may list)
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  portal_managed boolean not null default true,                                   -- true: no API, the partner redeems vouchers in the portal
  settlement_pct numeric(5,2) not null default 80 check (settlement_pct between 0 and 100),   -- share of the package price paid to the partner
  contact_name text,
  contact_email text,
  contact_phone text,
  admin_note text,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
drop policy if exists partners_read on public.partners;
create policy partners_read on public.partners for select to authenticated using (public.is_admin());

create table if not exists public.partner_members (
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  primary key (partner_id, user_id)
);
create index if not exists partner_members_user_idx on public.partner_members (user_id);
alter table public.partner_members enable row level security;
drop policy if exists partner_members_read on public.partner_members;
create policy partner_members_read on public.partner_members for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

-- packages: who owns them and where they came from ('api' = synced from a partner API, 'portal' = typed in by the partner)
alter table public.partner_packages add column if not exists partner_id uuid references public.partners(id) on delete set null;
alter table public.partner_packages add column if not exists source text not null default 'api' check (source in ('api','portal'));
-- RLS on partners hides it from travelers, so "is this partner active" is answered by a function that only returns a yes/no
create or replace function public.partner_is_active(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.partners p where p.id = p_id and p.status = 'active');
$$;
revoke all on function public.partner_is_active(uuid) from public;
grant execute on function public.partner_is_active(uuid) to anon, authenticated, service_role;
drop policy if exists partner_packages_read on public.partner_packages;
create policy partner_packages_read on public.partner_packages for select to anon, authenticated using (
  active and (partner_id is null or public.partner_is_active(partner_id)));

-- orders: which partner has to deliver, and which settlement paid it out
create table if not exists public.partner_settlements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  orders integer not null check (orders >= 0),
  gross_thb numeric(12,2) not null,
  partner_thb numeric(12,2) not null,
  paid_at timestamptz not null default now(),
  paid_by uuid references auth.users(id) on delete set null,
  note text,
  unique (partner_id, period)
);
alter table public.partner_settlements enable row level security;
drop policy if exists partner_settlements_read on public.partner_settlements;
create policy partner_settlements_read on public.partner_settlements for select to authenticated using (
  public.is_admin() or exists (select 1 from public.partner_members m where m.partner_id = partner_settlements.partner_id and m.user_id = (select auth.uid())));

alter table public.addon_orders add column if not exists partner_id uuid references public.partners(id) on delete set null;
alter table public.addon_orders add column if not exists settlement_id uuid references public.partner_settlements(id) on delete set null;
create index if not exists addon_orders_partner_idx on public.addon_orders (partner_id, status);

-- the code a traveler shows to a portal-managed partner: unique, so a code can never redeem two orders
create unique index if not exists addon_orders_portal_code_uidx on public.addon_orders ((partner_ref->>'portal_code')) where partner_ref ? 'portal_code';
