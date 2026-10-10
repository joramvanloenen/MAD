-- MAD shared museum collection: clean, idempotent Supabase schema.
-- Paste into the Supabase SQL Editor to create or repair a MAD database.
-- Visitor submissions are pending until reviewed by the site administrator.
create extension if not exists pgcrypto;

create table if not exists public.mad_artworks (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- These constraints also update installations created with older versions.
alter table public.mad_artworks drop constraint if exists mad_spot_format;
alter table public.mad_artworks add constraint mad_spot_format
  check (spot_id ~ '^(w|p|f|v|e|u|c)[0-9]{1,3}$');

alter table public.mad_artworks drop constraint if exists mad_payload_size;
alter table public.mad_artworks add constraint mad_payload_size
  check (octet_length(payload::text) < 3000000);

alter table public.mad_artworks drop constraint if exists mad_payload_title;
alter table public.mad_artworks add constraint mad_payload_title
  check (
    jsonb_typeof(payload->'title') = 'string' and
    length(trim(payload->>'title')) between 1 and 100
  );

alter table public.mad_artworks drop constraint if exists mad_payload_description;
alter table public.mad_artworks add constraint mad_payload_description
  check (
    jsonb_typeof(payload->'desc') = 'string' and
    length(trim(payload->>'desc')) between 1 and 500
  );

create index if not exists mad_artworks_public_view
  on public.mad_artworks(status,created_at desc);

alter table public.mad_artworks enable row level security;
revoke all on public.mad_artworks from anon,authenticated;
grant select,insert on public.mad_artworks to anon,authenticated;
drop policy if exists mad_read_approved on public.mad_artworks;
create policy mad_read_approved on public.mad_artworks
  for select to anon,authenticated using (status='approved');

drop policy if exists mad_submit_pending on public.mad_artworks;
create policy mad_submit_pending on public.mad_artworks
  for insert to anon,authenticated with check (status='pending');

-- In production configure rate limits/CAPTCHA and a review workflow.
-- Publishable/anon keys never grant permission to approve submissions.
