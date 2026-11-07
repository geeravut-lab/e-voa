-- AI provider routing: a short log of fallbacks and errors (never the question or the answer) and an insert-only history of the
-- administrator's added instructions. Idempotent.
create table if not exists public.ai_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  provider text not null,
  task text not null,
  status text not null check (status in ('fallback','error')),
  code text not null,
  message text not null default ''
);
create index if not exists ai_events_at_idx on public.ai_events (at desc);
alter table public.ai_events enable row level security;
drop policy if exists ai_events_admin on public.ai_events;
create policy ai_events_admin on public.ai_events for select to authenticated using (public.is_admin());

create table if not exists public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  task text not null check (task in ('chat')),
  body text not null check (char_length(body) <= 1500),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ai_prompt_versions_task_idx on public.ai_prompt_versions (task, created_at desc);
alter table public.ai_prompt_versions enable row level security;
drop policy if exists ai_prompt_versions_admin on public.ai_prompt_versions;
create policy ai_prompt_versions_admin on public.ai_prompt_versions for select to authenticated using (public.is_admin());
-- insert-only: the text and the time of a version never change and a version is never removed, so "who wrote what, when" can always be shown.
-- (Only the author link may be cleared, which is what deleting an account does.)
create or replace function public.ai_prompt_versions_frozen() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.body is distinct from old.body or new.task is distinct from old.task or new.created_at is distinct from old.created_at or new.id is distinct from old.id
    then raise exception 'ai_prompt_versions is insert-only'; end if;
  return new;
end $$;
drop trigger if exists ai_prompt_versions_no_change on public.ai_prompt_versions;
create trigger ai_prompt_versions_no_change before update or delete on public.ai_prompt_versions for each row execute function public.ai_prompt_versions_frozen();
