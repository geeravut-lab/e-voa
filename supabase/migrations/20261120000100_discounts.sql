-- Discount codes. A code lowers the SERVICE fee only (never the government visa fee or an add-on). Idempotent.
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  kind text not null check (kind in ('percent','fixed')),
  value integer not null check (value > 0 and (kind = 'fixed' or value <= 100)),   -- percent: 1..100; fixed: baht per payment
  active boolean not null default true,
  valid_from timestamptz,
  valid_to timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),                       -- across everybody; null = unlimited
  per_user integer not null default 1 check (per_user > 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.discount_codes enable row level security;
drop policy if exists discount_codes_admin on public.discount_codes;
create policy discount_codes_admin on public.discount_codes for select to authenticated using (public.is_admin());

-- one row per payment that used a code: reserved when checkout starts, released if the payment fails, so the limits count real orders
create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.discount_codes(id) on delete cascade,
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount_thb integer not null check (amount_thb > 0),
  created_at timestamptz not null default now()
);
create index if not exists discount_redemptions_code_idx on public.discount_redemptions (code_id);
alter table public.discount_redemptions enable row level security;
drop policy if exists discount_redemptions_admin on public.discount_redemptions;
create policy discount_redemptions_admin on public.discount_redemptions for select to authenticated using (public.is_admin());

alter table public.payments add column if not exists discount_thb integer not null default 0 check (discount_thb >= 0);

-- Takes the limits and the reservation in one step (the code row is locked), so two checkouts at the same moment cannot both take the last use.
create or replace function public.reserve_discount(p_code_id uuid, p_owner uuid, p_payment uuid, p_amount integer) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.discount_codes%rowtype; used integer; mine integer;
begin
  select * into c from public.discount_codes where id = p_code_id for update;
  if not found or not c.active then return 'err_discount_invalid'; end if;
  if (c.valid_from is not null and now() < c.valid_from) or (c.valid_to is not null and now() > c.valid_to) then return 'err_discount_expired'; end if;
  select count(*) into used from public.discount_redemptions where code_id = c.id;
  if c.max_uses is not null and used >= c.max_uses then return 'err_discount_used_up'; end if;
  select count(*) into mine from public.discount_redemptions where code_id = c.id and owner_id = p_owner;
  if mine >= c.per_user then return 'err_discount_per_user'; end if;
  insert into public.discount_redemptions (code_id, payment_id, owner_id, amount_thb) values (c.id, p_payment, p_owner, p_amount);
  return 'ok';
end $$;
revoke all on function public.reserve_discount(uuid, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_discount(uuid, uuid, uuid, integer) to service_role;
