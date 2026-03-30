-- Per-site isolation is enforced by wp_site_id on every row (one shared table; no cross-site mixing).
-- kind separates posts/pages vs future WooCommerce (or other) URLs so post sync never deletes product rows.

alter table public.site_internal_links
  drop constraint if exists site_internal_links_kind_check;

alter table public.site_internal_links
  add constraint site_internal_links_kind_check
  check (kind in ('post', 'page', 'product', 'other'));

create index if not exists site_internal_links_wp_site_kind_idx
  on public.site_internal_links (wp_site_id, kind);

comment on table public.site_internal_links is
  'Internal link catalog: each row belongs to exactly one wp_sites.id. Unique (wp_site_id, url). Use kind=post|page vs product so sync jobs only replace their own kind.';

comment on column public.site_internal_links.wp_site_id is
  'Required. All API queries filter by this UUID so Site A never reads Site B links.';

comment on column public.site_internal_links.kind is
  'post/page = WordPress content; product = WooCommerce (separate sync); other = manual/import.';
