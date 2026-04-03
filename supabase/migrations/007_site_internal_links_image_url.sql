-- Product thumbnail for Shop Now cards (WooCommerce featured/first image).
alter table public.site_internal_links
  add column if not exists image_url text;

comment on column public.site_internal_links.image_url is 'Optional image URL (e.g. WooCommerce product image); used in generated product CTA HTML.';
