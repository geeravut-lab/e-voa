-- Places a signed-in traveler wants official weather warnings for (max 5, enforced by the app). Own rows only.
create table if not exists public.warning_watches (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_slug text not null check (place_slug ~ '^[a-z-]{2,40}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, place_slug)
);
alter table public.warning_watches enable row level security;
drop policy if exists warning_watches_select on public.warning_watches;
create policy warning_watches_select on public.warning_watches for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists warning_watches_insert on public.warning_watches;
create policy warning_watches_insert on public.warning_watches for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists warning_watches_delete on public.warning_watches;
create policy warning_watches_delete on public.warning_watches for delete to authenticated using (user_id = (select auth.uid()));
