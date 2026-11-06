-- Daily token use of the help assistant (a spending guard: the server refuses new questions once the day's budget is used). Idempotent.
create table if not exists public.ai_usage (
  day date primary key,
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0
);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_admin on public.ai_usage;
create policy ai_usage_admin on public.ai_usage for select to authenticated using (public.is_admin());

create or replace function public.ai_usage_add(p_in integer, p_out integer) returns void
language sql security definer set search_path = '' as $$
  insert into public.ai_usage as u (day, requests, input_tokens, output_tokens)
  values ((now() at time zone 'Asia/Bangkok')::date, 1, greatest(p_in, 0), greatest(p_out, 0))
  on conflict (day) do update set requests = u.requests + 1, input_tokens = u.input_tokens + greatest(p_in, 0), output_tokens = u.output_tokens + greatest(p_out, 0);
$$;
revoke all on function public.ai_usage_add(integer, integer) from public, anon, authenticated;
grant execute on function public.ai_usage_add(integer, integer) to service_role;
