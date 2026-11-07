-- Partner portal extras: a limited quantity per package (null = unlimited). Idempotent.
alter table public.partner_packages add column if not exists stock_total integer check (stock_total is null or stock_total >= 0);

-- The quantity left is the partner's business: travelers and visitors read the catalogue, but not this column.
revoke select on public.partner_packages from anon, authenticated;
grant select (provider, package_code, category, name, detail, price_thb, price_usd, price_cny, terms, ref_link, image, active, synced_at, partner_id, source) on public.partner_packages to anon, authenticated;
