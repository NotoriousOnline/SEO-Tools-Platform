-- Append-only server logs for the Content Studio dashboard (/logs).
-- Accessed only via Supabase service role from API routes.

create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null check (level in ('error', 'warn', 'info')),
  source text not null,
  message text not null,
  meta jsonb
);

create index if not exists app_logs_created_at_idx on public.app_logs (created_at desc);

alter table public.app_logs enable row level security;

-- No policies: anon/authenticated cannot read; service role bypasses RLS.

comment on table public.app_logs is 'Server-side log lines written by Next.js API routes for the in-app Logs viewer.';
