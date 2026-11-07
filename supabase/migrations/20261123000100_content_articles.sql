-- Travel articles written in the back office (a third kind of content_items). Idempotent.
alter table public.content_items drop constraint if exists content_items_kind_check;
alter table public.content_items add constraint content_items_kind_check check (kind in ('faq','news','article'));
alter table public.content_items add column if not exists slug text;            -- the address: /articles/<slug>; never changes after it is made
alter table public.content_items add column if not exists summary jsonb;       -- one or two sentences per language (list page and search results)
alter table public.content_items drop constraint if exists content_items_slug_check;
alter table public.content_items add constraint content_items_slug_check check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80));
create unique index if not exists content_items_slug_uidx on public.content_items (slug) where slug is not null;
