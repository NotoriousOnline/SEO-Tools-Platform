-- Run this in your Supabase dashboard SQL editor after 001_wp_sites.sql
-- Replace YOUR_WP_USERNAME and YOUR_WP_APP_PASSWORD with real values
insert into wp_sites (name, url, username, app_password, tone_prompt)
values (
  'Green.org',
  'https://green.org',
  'YOUR_WP_USERNAME',
  'YOUR_WP_APP_PASSWORD',
  'Write in an authoritative, sustainability-focused editorial tone. Target environmentally conscious readers. Use data and expert insight to support claims.'
);
