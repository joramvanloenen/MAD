-- MAD shared artworks. Run in Supabase SQL Editor.
-- Visitors can READ approved artworks and SUBMIT new works for moderation.
-- They cannot publish, edit, delete or approve their own rows.
create extension if not exists pgcrypto;
create table if not exists public.mad_artworks (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  constraint mad_spot_format check (spot_id ~ '^(w|p|f)[0-9]{1,3}$'),
  constraint mad_payload_size check (octet_length(payload::text) < 3000000),
  constraint mad_payload_title check (
    jsonb_typeof(payload->'title') = 'string' and
    length(trim(payload->>'title')) between 1 and 100
  ),
  constraint mad_payload_description check (
    jsonb_typeof(payload->'desc') = 'string' and
    length(trim(payload->>'desc')) between 1 and 500
  )
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
-- Important: in production, configure Supabase API rate limits / CAPTCHA
-- and storage quotas. For moderation, review pending rows in the Table Editor,
-- then change status to approved. The browser keys CANNOT do approvals.
