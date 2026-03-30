-- Scope WordPress site rows per tool so Weed.com and generic Content Production stay separate.
alter table wp_sites
  add column if not exists tool_scope text not null default 'content-production';

comment on column wp_sites.tool_scope is 'content-production | weed-com-content-production';
