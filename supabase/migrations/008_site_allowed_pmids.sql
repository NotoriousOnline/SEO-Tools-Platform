-- Approved PMIDs per WordPress site for Weed.com Learn Expert Insight / Sources (Layer 1).
-- Populate via Supabase dashboard or future admin API; generation reads by wp_site_id.

create table if not exists public.site_allowed_pmids (
  id uuid primary key default gen_random_uuid(),
  wp_site_id uuid not null references public.wp_sites (id) on delete cascade,
  pmid bigint not null,
  citation_line text,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (wp_site_id, pmid)
);

create index if not exists site_allowed_pmids_wp_site_id_idx on public.site_allowed_pmids (wp_site_id);

alter table public.site_allowed_pmids enable row level security;

comment on table public.site_allowed_pmids is
  'When non-empty for a site, generate-content restricts PubMed citations to these PMIDs only (Weed Learn).';

comment on column public.site_allowed_pmids.citation_line is
  'Optional full bibliographic line for prompts (authors, year, title, journal); copied into Expert Insight when set.';
