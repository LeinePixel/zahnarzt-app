-- PROJ-31 establishes one database-side session boundary for direct table
-- access and every authenticated SECURITY DEFINER RPC. It relies only on
-- documented JWT claims plus the current local auth.sessions row. Human
-- activity updates are added by the browser-lock task; callers cannot write
-- the private state directly.

create table private.session_security_state (
  session_id uuid primary key,
  user_id uuid not null,
  started_at timestamptz not null,
  last_human_activity_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint session_security_state_started_before_activity_check
    check (started_at <= last_human_activity_at),
  constraint session_security_state_revocation_check
    check (revoked_at is null or revoked_at >= started_at)
);

create index session_security_state_user_id_idx
  on private.session_security_state (user_id);
create index session_security_state_activity_idx
  on private.session_security_state (last_human_activity_at);

revoke all on table private.session_security_state
  from public, anon, authenticated;

create function private.current_session_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session_id text := auth.jwt() ->> 'session_id';
begin
  if v_session_id is null or v_session_id = '' then
    return null;
  end if;

  return v_session_id::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create function private.has_valid_aal2_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null
      and auth.jwt() ->> 'aal' = 'aal2'
      and exists (
        select 1
        from private.session_security_state as state
        join auth.sessions as session
          on session.id = state.session_id
         and session.user_id = state.user_id
        join auth.users as auth_user
          on auth_user.id = state.user_id
        where state.session_id = private.current_session_id()
          and state.user_id = auth.uid()
          and session.aal = 'aal2'
          and (session.not_after is null or session.not_after > pg_catalog.now())
          and auth_user.deleted_at is null
          and (
            auth_user.banned_until is null
            or auth_user.banned_until <= pg_catalog.now()
          )
          and state.revoked_at is null
          and state.last_human_activity_at + interval '5 minutes'
            > pg_catalog.now()
          and state.started_at + interval '8 hours' > pg_catalog.now()
      ),
    false
  );
$$;

create function public.initialize_current_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := private.current_session_id();
  v_session auth.sessions%rowtype;
begin
  if v_user_id is null
    or v_session_id is null
    or auth.jwt() ->> 'aal' <> 'aal2' then
    return false;
  end if;

  select session.*
  into v_session
  from auth.sessions as session
  join auth.users as auth_user on auth_user.id = session.user_id
  where session.id = v_session_id
    and session.user_id = v_user_id
    and session.aal = 'aal2'
    and (session.not_after is null or session.not_after > pg_catalog.now())
    and auth_user.deleted_at is null
    and (
      auth_user.banned_until is null
      or auth_user.banned_until <= pg_catalog.now()
    );

  if not found
    or v_session.created_at is null
    or v_session.created_at + interval '8 hours' <= pg_catalog.now() then
    return false;
  end if;

  insert into private.session_security_state (
    session_id,
    user_id,
    started_at,
    last_human_activity_at
  )
  values (
    v_session.id,
    v_user_id,
    v_session.created_at,
    pg_catalog.now()
  )
  on conflict (session_id) do nothing;

  return private.has_valid_aal2_session();
end;
$$;

revoke all on function private.current_session_id()
  from public, anon, authenticated;
revoke all on function private.has_valid_aal2_session()
  from public, anon, authenticated;
grant execute on function private.has_valid_aal2_session()
  to authenticated;
revoke all on function public.initialize_current_session()
  from public, anon, authenticated;
grant execute on function public.initialize_current_session()
  to authenticated;

drop policy "users can read only their own profile" on public.user_profile;
create policy "AAL2 users can read only their own profile"
  on public.user_profile
  for select
  to authenticated
  using (
    private.has_valid_aal2_session()
    and (select auth.uid()) = user_id
  );

drop policy "users can read only their own practice" on public.practice;
create policy "AAL2 users can read only their own practice"
  on public.practice
  for select
  to authenticated
  using (
    private.has_valid_aal2_session()
    and exists (
      select 1
      from public.user_profile as profile
      where profile.user_id = (select auth.uid())
        and profile.practice_id = practice.id
    )
  );

-- Keep the already reviewed PROJ-19 implementations intact and place a thin
-- fail-closed session gate in front of each public RPC.
alter function public.record_denied_audit_read() set schema private;
alter function private.record_denied_audit_read()
  rename to proj_19_record_denied_audit_read;
alter function public.request_support_access(integer) set schema private;
alter function private.request_support_access(integer)
  rename to proj_19_request_support_access;
alter function public.activate_support_access(uuid, public.support_reason)
  set schema private;
alter function private.activate_support_access(uuid, public.support_reason)
  rename to proj_19_activate_support_access;
alter function public.revoke_support_access(uuid) set schema private;
alter function private.revoke_support_access(uuid)
  rename to proj_19_revoke_support_access;
alter function public.read_audit_events(uuid, timestamptz, integer)
  set schema private;
alter function private.read_audit_events(uuid, timestamptz, integer)
  rename to proj_19_read_audit_events;
alter function public.is_portal_admin() set schema private;
alter function private.is_portal_admin()
  rename to proj_19_is_portal_admin;
alter function public.read_integration_sync_status() set schema private;
alter function private.read_integration_sync_status()
  rename to proj_3_read_integration_sync_status;

revoke all on function private.proj_19_record_denied_audit_read()
  from public, anon, authenticated;
revoke all on function private.proj_19_request_support_access(integer)
  from public, anon, authenticated;
revoke all on function private.proj_19_activate_support_access(
  uuid,
  public.support_reason
) from public, anon, authenticated;
revoke all on function private.proj_19_revoke_support_access(uuid)
  from public, anon, authenticated;
revoke all on function private.proj_19_read_audit_events(
  uuid,
  timestamptz,
  integer
) from public, anon, authenticated;
revoke all on function private.proj_19_is_portal_admin()
  from public, anon, authenticated;
revoke all on function private.proj_3_read_integration_sync_status()
  from public, anon, authenticated;

create function public.record_denied_audit_read()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_valid_aal2_session() then
    return false;
  end if;

  return private.proj_19_record_denied_audit_read();
end;
$$;

create function public.request_support_access(
  p_requested_duration_hours integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_valid_aal2_session() then
    return null;
  end if;

  return private.proj_19_request_support_access(p_requested_duration_hours);
end;
$$;

create function public.activate_support_access(
  p_grant_id uuid,
  p_reason public.support_reason
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_valid_aal2_session() then
    return null;
  end if;

  return private.proj_19_activate_support_access(p_grant_id, p_reason);
end;
$$;

create function public.revoke_support_access(p_grant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_valid_aal2_session() then
    return false;
  end if;

  return private.proj_19_revoke_support_access(p_grant_id);
end;
$$;

create function public.read_audit_events(
  p_practice_id uuid,
  p_before timestamptz,
  p_limit integer
)
returns table (
  event_id uuid,
  actor_type public.audit_actor_type,
  actor_id uuid,
  occurred_at timestamptz,
  action public.audit_action,
  outcome public.audit_outcome,
  resource_type text,
  resource_id uuid,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_valid_aal2_session() then
    return;
  end if;

  return query
  select *
  from private.proj_19_read_audit_events(
    p_practice_id,
    p_before,
    p_limit
  );
end;
$$;

create function public.is_portal_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_valid_aal2_session() then
    return false;
  end if;

  return private.proj_19_is_portal_admin();
end;
$$;

create function public.read_integration_sync_status()
returns table (
  integration_id uuid,
  provider public.integration_provider,
  status public.integration_sync_status,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_attempt_at timestamptz,
  last_error_code public.integration_sync_error_code
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_valid_aal2_session() then
    return;
  end if;

  return query
  select * from private.proj_3_read_integration_sync_status();
end;
$$;

revoke all on function public.record_denied_audit_read()
  from public, anon, authenticated;
revoke all on function public.request_support_access(integer)
  from public, anon, authenticated;
revoke all on function public.activate_support_access(uuid, public.support_reason)
  from public, anon, authenticated;
revoke all on function public.revoke_support_access(uuid)
  from public, anon, authenticated;
revoke all on function public.read_audit_events(uuid, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.is_portal_admin()
  from public, anon, authenticated;
revoke all on function public.read_integration_sync_status()
  from public, anon, authenticated;

grant execute on function public.record_denied_audit_read()
  to authenticated;
grant execute on function public.request_support_access(integer)
  to authenticated;
grant execute on function public.activate_support_access(uuid, public.support_reason)
  to authenticated;
grant execute on function public.revoke_support_access(uuid)
  to authenticated;
grant execute on function public.read_audit_events(uuid, timestamptz, integer)
  to authenticated;
grant execute on function public.is_portal_admin()
  to authenticated;
grant execute on function public.read_integration_sync_status()
  to authenticated;
