-- Run this in your Supabase dashboard SQL editor
create table wp_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  username text not null,
  app_password text not null,
  tone_prompt text not null default 'Write in a clear, authoritative, and engaging editorial tone.',
  created_at timestamptz default now()
);
