-- FAQ and news written in the back office. Text per language ({"en": "...", "th": "...", "zh-CN": "..."}); a missing language shows the English text. Idempotent.
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('faq','news')),
  title jsonb not null,                       -- the question, or the headline
  body jsonb not null,                        -- the answer, or the news text
  published boolean not null default false,
  pinned boolean not null default false,      -- news: also shown as a banner on the home page
  sort integer not null default 0,            -- FAQ order (smaller first)
  published_at timestamptz,                   -- news date
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_items_list_idx on public.content_items (kind, published, sort, published_at desc);
alter table public.content_items enable row level security;
drop policy if exists content_items_admin on public.content_items;
create policy content_items_admin on public.content_items for select to authenticated using (public.is_admin());   -- visitors read through the server
