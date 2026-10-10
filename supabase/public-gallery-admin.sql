-- MAD: anonymous public artworks, code-only administrator.
-- Authentication is NOT required for visitors. All privileged operations
-- are performed by SECURITY DEFINER RPCs with an expiring random token.
create schema if not exists mad_private;
revoke all on schema mad_private from public,anon,authenticated;

create table if not exists mad_private.admin_settings (
 id int primary key check (id=1),
 code_hash text,
 failure_count int not null default 0,
 locked_until timestamptz
);
insert into mad_private.admin_settings(id) values (1) on conflict do nothing;
create table if not exists mad_private.admin_sessions (
 token_hash bytea primary key,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null
);
revoke all on mad_private.admin_settings from public,anon,authenticated;
revoke all on mad_private.admin_sessions from public,anon,authenticated;

-- Bootstrap or rotate the secret from the SQL Editor / trusted management API.
-- Only a privileged DB operator can call this function, and the code is
-- returned ONCE; neither code nor plaintext key appears in migrations / git.
create or replace function mad_private.reset_admin_code()
returns text language plpgsql security invoker
set search_path=''
as $$
declare generated text;
begin
 generated:=upper(pg_catalog.encode(extensions.gen_random_bytes(12),'hex'));
 update mad_private.admin_settings
 set code_hash=extensions.crypt(generated,extensions.gen_salt('bf',12)),
     failure_count=0,locked_until=null where id=1;
 delete from mad_private.admin_sessions;
 return generated;
end;
$$;
revoke all on function mad_private.reset_admin_code() from public,anon,authenticated;

-- Rate-limited login. A failure returns NULL (not an exception) so the
-- counter and temporary lock are COMMITTED rather than rolled back.
create or replace function public.mad_admin_login(p_code text)
returns text language plpgsql volatile security definer
set search_path=''
as $$
declare s mad_private.admin_settings%rowtype; plain text;
begin
 select * into s from mad_private.admin_settings where id=1 for update;
 if s.code_hash is null or s.locked_until > pg_catalog.now() then
  return null;
 end if;
 if p_code is null or length(p_code)>128 or
    extensions.crypt(p_code,s.code_hash) is distinct from s.code_hash then
  update mad_private.admin_settings
    set failure_count=case when locked_until is not null and locked_until<pg_catalog.now()
      then 1 else failure_count+1 end,
      locked_until=case when failure_count>=7 then pg_catalog.now()+interval '15 minutes'
      else null end
    where id=1;
  return null;
 end if;
 update mad_private.admin_settings set failure_count=0,locked_until=null where id=1;
 delete from mad_private.admin_sessions where expires_at < pg_catalog.now();
 plain:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 insert into mad_private.admin_sessions(token_hash,expires_at)
 values(extensions.digest(plain,'sha256'),pg_catalog.now()+interval '12 hours');
 return plain;
end;
$$;

create or replace function mad_private.valid_admin_token(p_token text)
returns boolean language sql stable security definer
set search_path=''
as $$
 select p_token is not null and length(p_token)=64
   and exists (
     select 1 from mad_private.admin_sessions s
     where s.token_hash=extensions.digest(p_token,'sha256')
       and s.expires_at>pg_catalog.now()
   );
$$;
revoke all on function mad_private.valid_admin_token(text) from public,anon,authenticated;

create or replace function public.mad_admin_active(p_token text)
returns boolean language sql stable security definer
set search_path=''
as $$
 select mad_private.valid_admin_token(p_token);
$$;
create or replace function public.mad_admin_logout(p_token text)
returns void language plpgsql volatile security definer
set search_path=''
as $$
begin
 delete from mad_private.admin_sessions
  where token_hash=extensions.digest(coalesce(p_token,''),'sha256');
end;
$$;
create or replace function public.mad_admin_list(p_token text,p_status text default 'approved')
returns setof public.mad_artworks language plpgsql stable security definer
set search_path=''
as $$
begin
 if not mad_private.valid_admin_token(p_token) then
  raise exception 'Admin login required' using errcode='42501';
 end if;
 if p_status not in ('pending','approved','rejected') then
  raise exception 'Invalid status';
 end if;
 return query select a.* from public.mad_artworks a
  where a.status=p_status order by a.created_at desc limit 250;
end;
$$;
create or replace function public.mad_admin_set_status(
 p_token text,p_id uuid,p_status text)
returns boolean language plpgsql volatile security definer
set search_path=''
as $$
begin
 if not mad_private.valid_admin_token(p_token) then
  raise exception 'Admin login required' using errcode='42501';
 end if;
 if p_status not in ('pending','approved','rejected') then
  raise exception 'Invalid status';
 end if;
 update public.mad_artworks set status=p_status where id=p_id;
 return found;
end;
$$;
create or replace function public.mad_admin_delete(p_token text,p_id uuid)
returns boolean language plpgsql volatile security definer
set search_path=''
as $$
begin
 if not mad_private.valid_admin_token(p_token) then
  raise exception 'Admin login required' using errcode='42501';
 end if;
 delete from public.mad_artworks where id=p_id;
 return found;
end;
$$;

-- No public role can call the private verifier or manage underlying tables.
-- Public RPCs accept a cryptographically random bearer token only.
revoke all on function public.mad_admin_login(text) from public;
revoke all on function public.mad_admin_active(text) from public;
revoke all on function public.mad_admin_logout(text) from public;
revoke all on function public.mad_admin_list(text,text) from public;
revoke all on function public.mad_admin_set_status(text,uuid,text) from public;
revoke all on function public.mad_admin_delete(text,uuid) from public;
grant execute on function public.mad_admin_login(text) to anon,authenticated;
grant execute on function public.mad_admin_active(text) to anon,authenticated;
grant execute on function public.mad_admin_logout(text) to anon,authenticated;
grant execute on function public.mad_admin_list(text,text) to anon,authenticated;
grant execute on function public.mad_admin_set_status(text,uuid,text) to anon,authenticated;
grant execute on function public.mad_admin_delete(text,uuid) to anon,authenticated;

-- Reset Google auth based permissions and enable universal anonymous art.
drop policy if exists mad_read_approved on public.mad_artworks;
drop policy if exists mad_submit_pending on public.mad_artworks;
drop policy if exists mad_read on public.mad_artworks;
drop policy if exists mad_insert on public.mad_artworks;
drop policy if exists mad_modify_pending on public.mad_artworks;
drop policy if exists mad_delete on public.mad_artworks;
revoke all on public.mad_artworks from anon,authenticated;
grant select(id,spot_id,payload,status,created_at) on public.mad_artworks to anon,authenticated;
grant insert(id,spot_id,payload,status) on public.mad_artworks to anon,authenticated;
create policy mad_read on public.mad_artworks for select to anon,authenticated
 using(status='approved');
create policy mad_insert on public.mad_artworks for insert to anon,authenticated
 with check(status='approved' and owner_id is null);
alter table public.mad_artworks enable row level security;

-- Obsolete Google-admin RPC must not remain accessible.
drop function if exists public.mad_is_admin();
-- The existing trigger prevents double-booking a spot via anonymous insert.
revoke all on function public.mad_guard_approval() from public,anon,authenticated;
