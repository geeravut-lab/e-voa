-- Tax invoices (one per payment, requested by the traveler once the payment is paid). Idempotent.
create sequence if not exists public.invoice_seq;
create table if not exists public.tax_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  issued_at timestamptz not null default now(),
  buyer jsonb not null,            -- name, address, tax id, branch as the buyer typed them
  seller jsonb not null,           -- company details at the time of issue (frozen)
  lines jsonb not null,            -- label, amount, vat treatment per line (frozen)
  vat_registered boolean not null,
  vat_rate numeric(5,2) not null,
  net_thb numeric(12,2) not null,
  vat_thb numeric(12,2) not null,
  total_thb numeric(12,2) not null
);
alter table public.tax_invoices enable row level security;
drop policy if exists tax_invoices_read on public.tax_invoices;
create policy tax_invoices_read on public.tax_invoices for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());

create or replace function public.next_invoice_no() returns text
language sql security definer set search_path = '' as $$
  select 'TI-' || to_char((now() at time zone 'Asia/Bangkok'), 'YY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0');
$$;
revoke all on function public.next_invoice_no() from public, anon, authenticated;
grant execute on function public.next_invoice_no() to service_role;
