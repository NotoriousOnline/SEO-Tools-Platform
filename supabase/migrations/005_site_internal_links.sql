-- Per-site catalog of URLs for internal linking (synced from WordPress; extend later for products/Woo).
-- Run in Supabase SQL editor after previous migrations.

create table if not exists public.site_internal_links (
  id uuid primary key default gen_random_uuid(),
  wp_site_id uuid not null references public.wp_sites (id) on delete cascade,
  wp_post_id bigint,
  url text not null,
  title text not null,
  slug text,
  kind text not null default 'post',
  excerpt text,
  search_text text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (wp_site_id, url)
);

create index if not exists site_internal_links_wp_site_id_idx on public.site_internal_links (wp_site_id);

alter table public.site_internal_links enable row level security;

comment on table public.site_internal_links is 'Cached post/page URLs per wp_sites row for internal linking; populated via API sync from WP REST.';
