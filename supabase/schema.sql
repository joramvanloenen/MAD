-- MAD secure shared gallery (run in Supabase SQL Editor).
-- Google OAuth must be enabled in Supabase Auth > Providers.
-- Admin is granted ONLY to the verified Google identity named below.
create extension if not exists pgcrypto;

create table if not exists public.mad_artworks (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null,
  owner_id uuid references auth.users(id) on delete set null,
  payload jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.mad_artworks
  add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.mad_artworks
  drop constraint if exists mad_artworks_status_check;
alter table public.mad_artworks add constraint mad_artworks_status_check
  check (status in ('pending','approved','rejected'));
alter table public.mad_artworks drop constraint if exists mad_spot_format;
alter table public.mad_artworks add constraint mad_spot_format
  check (spot_id ~ '^(w|p|f|v|e|u|c)[0-9]{1,3}$');
alter table public.mad_artworks drop constraint if exists mad_payload_size;
alter table public.mad_artworks add constraint mad_payload_size
  check (octet_length(payload::text) < 3000000);
alter table public.mad_artworks drop constraint if exists mad_payload_title;
alter table public.mad_artworks add constraint mad_payload_title
  check (jsonb_typeof(payload->'title')='string' and
    length(trim(payload->>'title')) between 1 and 100);
alter table public.mad_artworks drop constraint if exists mad_payload_description;
alter table public.mad_artworks add constraint mad_payload_description
  check (jsonb_typeof(payload->'desc')='string' and
    length(trim(payload->>'desc')) between 1 and 500);
alter table public.mad_artworks drop constraint if exists mad_payload_matches_spot;
alter table public.mad_artworks add constraint mad_payload_matches_spot
  check (payload->>'spotId' = spot_id);
create index if not exists mad_artworks_status_date
  on public.mad_artworks(status,created_at desc);
create index if not exists mad_artworks_owner
  on public.mad_artworks(owner_id,created_at desc);

-- SECURITY DEFINER reads server-authenticated accounts and linked
-- Google identities. A matching string typed in a client payload is
-- NEVER sufficient; self-reported JWT email is also NOT used.
create or replace function public.mad_is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    join auth.identities i on i.user_id = u.id
    where u.id = (select auth.uid())
      and lower(u.email) = 'joramvanloenen@gmail.com'
      and u.email_confirmed_at is not null
      and i.provider = 'google'
      and lower(i.identity_data->>'email') = 'joramvanloenen@gmail.com'
  );
$$;
revoke all on function public.mad_is_admin() from public;
grant execute on function public.mad_is_admin() to anon,authenticated;

-- Never let clients submit preapproved work or claim somebody else's art.
-- Legacy artworks may retain owner_id NULL; they can only be moderated
-- using a Google-verified admin account.
alter table public.mad_artworks enable row level security;
revoke all on public.mad_artworks from anon,authenticated;
grant select on public.mad_artworks to anon;
grant select,insert,update,delete on public.mad_artworks to authenticated;
drop policy if exists mad_read_approved on public.mad_artworks;
drop policy if exists mad_submit_pending on public.mad_artworks;
drop policy if exists mad_read on public.mad_artworks;
drop policy if exists mad_insert on public.mad_artworks;
drop policy if exists mad_modify_pending on public.mad_artworks;
drop policy if exists mad_delete on public.mad_artworks;

create policy mad_read on public.mad_artworks for select
to anon,authenticated using (
  status='approved'
  or owner_id=(select auth.uid())
  or (select public.mad_is_admin())
);
create policy mad_insert on public.mad_artworks for insert
to authenticated with check (
  owner_id=(select auth.uid()) and status='pending'
);
-- A creator may edit only their pending work and cannot promote it;
-- a verified admin may approve/reject any submission.
create policy mad_modify_pending on public.mad_artworks for update
to authenticated using (
  (owner_id=(select auth.uid()) and status='pending')
  or (select public.mad_is_admin())
) with check (
  (owner_id=(select auth.uid()) and status='pending')
  or (select public.mad_is_admin())
);
create policy mad_delete on public.mad_artworks for delete
to authenticated using (
  (owner_id=(select auth.uid()) and status='pending')
  or (select public.mad_is_admin())
);

-- Approval checks active occupancy while holding a per-spot transaction lock
-- so two admins cannot approve competing submissions into the same slot.
create or replace function public.mad_guard_approval()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  needs_guard boolean := false;
begin
  if TG_OP = 'INSERT' then
    needs_guard := NEW.status = 'approved';
  else
    needs_guard := NEW.status = 'approved' and
      OLD.status is distinct from NEW.status;
  end if;
  if needs_guard then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.spot_id));
    if exists (
      select 1 from public.mad_artworks a
      where a.spot_id=NEW.spot_id and a.id<>NEW.id
        and a.status='approved'
        and (
          a.payload->>'audience'='after-hours'
          or a.created_at > pg_catalog.now()-interval '14 days'
        )
    ) then
      raise exception 'This exhibit spot already contains an approved artwork.';
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists mad_approval_guard on public.mad_artworks;
create trigger mad_approval_guard before insert or update of status
on public.mad_artworks for each row
execute function public.mad_guard_approval();

-- Supabase service-role bypasses RLS and must NEVER be included in GitHub
-- Pages JavaScript, browser developer tools, or mad-config.js.
