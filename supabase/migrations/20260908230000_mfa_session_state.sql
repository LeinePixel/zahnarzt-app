-- T04: private, server-timestamped session state. Browser-provided clocks and
-- timers never participate in authorization.
create table private.auth_session_state (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  established_at timestamptz not null default pg_catalog.now(),
  last_human_activity_at timestamptz not null default pg_catalog.now(),
  fresh_totp_at timestamptz not null default pg_catalog.now(),
  check (last_human_activity_at >= established_at),
  check (fresh_totp_at >= established_at)
);

revoke all on table private.auth_session_state from public, anon, authenticated;

create or replace function private.has_current_aal2_identity()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := auth.jwt();
  v_claim_sub uuid;
  v_session_id uuid;
begin
  if jsonb_typeof(v_claims) is distinct from 'object'
    or v_claims ->> 'aal' is distinct from 'aal2' then
    return false;
  end if;

  begin
    v_claim_sub := (v_claims ->> 'sub')::uuid;
    v_session_id := (v_claims ->> 'session_id')::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  if v_claim_sub is null
    or v_session_id is null
    or auth.uid() is distinct from v_claim_sub then
    return false;
  end if;

  return exists (
    select 1
    from auth.sessions as session
    join auth.users as app_user on app_user.id = session.user_id
    where session.id = v_session_id
      and session.user_id = v_claim_sub
      and session.aal = 'aal2'
      and (session.not_after is null or session.not_after > pg_catalog.now())
      and app_user.deleted_at is null
      and (app_user.banned_until is null or app_user.banned_until <= pg_catalog.now())
  );
end;
$$;

create or replace function private.has_fresh_totp_amr()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := auth.jwt();
begin
  if jsonb_typeof(v_claims -> 'amr') is distinct from 'array' then
    return false;
  end if;

  return exists (
    select 1
    from jsonb_array_elements(v_claims -> 'amr') as amr_entry(value)
    where jsonb_typeof(amr_entry.value) = 'object'
      and amr_entry.value ->> 'method' in ('totp', 'mfa/totp')
      and jsonb_typeof(amr_entry.value -> 'timestamp') = 'number'
      and (amr_entry.value ->> 'timestamp')::numeric
        between extract(epoch from pg_catalog.now() - interval '5 minutes')
          and extract(epoch from pg_catalog.now() + interval '1 minute')
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return false;
end;
$$;

create function private.current_claim_session_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (auth.jwt() ->> 'session_id')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function private.has_current_aal2_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_current_aal2_identity()
    and exists (
      select 1
      from private.auth_session_state as state
      where state.session_id = private.current_claim_session_id()
        and state.user_id = auth.uid()
        and state.established_at > pg_catalog.now() - interval '8 hours'
        and state.last_human_activity_at > pg_catalog.now() - interval '5 minutes'
    );
$$;

create or replace function private.has_current_aal2_session(
  p_require_fresh_totp boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_current_aal2_session()
    and (
      not p_require_fresh_totp
      or exists (
        select 1
        from private.auth_session_state as state
        where state.session_id = private.current_claim_session_id()
          and state.user_id = auth.uid()
          and state.fresh_totp_at > pg_catalog.now() - interval '5 minutes'
      )
    );
$$;

create function public.establish_session_state()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  if not private.has_current_aal2_identity()
    or not private.has_fresh_totp_amr() then
    return false;
  end if;

  begin
    v_session_id := (auth.jwt() ->> 'session_id')::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  insert into private.auth_session_state (
    session_id,
    user_id,
    established_at,
    last_human_activity_at,
    fresh_totp_at
  )
  values (
    v_session_id,
    auth.uid(),
    pg_catalog.now(),
    pg_catalog.now(),
    pg_catalog.now()
  )
  on conflict (session_id) do update
  set last_human_activity_at = excluded.last_human_activity_at,
      fresh_totp_at = excluded.fresh_totp_at
  where private.auth_session_state.user_id = auth.uid()
    and private.auth_session_state.established_at > pg_catalog.now() - interval '8 hours';

  return found;
end;
$$;

create function public.touch_session_state()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  if not private.has_current_aal2_session() then
    return false;
  end if;

  begin
    v_session_id := (auth.jwt() ->> 'session_id')::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  update private.auth_session_state
  set last_human_activity_at = pg_catalog.now()
  where session_id = v_session_id
    and user_id = auth.uid()
    and established_at > pg_catalog.now() - interval '8 hours'
    and last_human_activity_at > pg_catalog.now() - interval '5 minutes';

  return found;
end;
$$;

create function public.session_gate()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.jwt() ->> 'aal' is distinct from 'aal2' then
    return 'mfa_required';
  end if;

  if private.has_current_aal2_session() then
    return 'ready';
  end if;

  return 'reauth_required';
end;
$$;

revoke all on function private.has_current_aal2_identity() from public, anon, authenticated;
revoke all on function private.has_fresh_totp_amr() from public, anon, authenticated;
revoke all on function private.current_claim_session_id() from public, anon, authenticated;
revoke all on function private.has_current_aal2_session(boolean) from public, anon, authenticated;
revoke all on function public.establish_session_state() from public, anon;
revoke all on function public.touch_session_state() from public, anon;
revoke all on function public.session_gate() from public, anon;
revoke all on function public.record_denied_audit_read() from public, anon, authenticated;
grant execute on function public.establish_session_state() to authenticated;
grant execute on function public.touch_session_state() to authenticated;
grant execute on function public.session_gate() to authenticated;

create or replace function public.request_support_access(
  p_requested_duration_hours integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_type public.audit_actor_type;
  v_practice_id uuid;
  v_role public.user_role;
  v_duration_hours integer := coalesce(p_requested_duration_hours, 8);
  v_grant_id uuid;
  v_requested_at timestamptz := pg_catalog.now();
begin
  if not private.has_current_aal2_session() then return null; end if;
  v_actor_type := private.audit_actor_type_for(v_actor_id);
  select profile.practice_id, profile.role into v_practice_id, v_role
  from public.user_profile as profile where profile.user_id = v_actor_id;
  if not private.has_current_aal2_session(true) then
    perform private.write_audit_event(v_practice_id, v_actor_id, v_actor_type, 'support_access_requested', 'denied', 'support_access_grant', null);
    return null;
  end if;
  if v_duration_hours not between 1 and 24 or v_role is distinct from 'praxisadmin' then
    perform private.write_audit_event(v_practice_id, v_actor_id, v_actor_type, 'support_access_requested', 'denied', 'support_access_grant', null);
    return null;
  end if;
  insert into public.support_access_grant (practice_id, requested_by, requested_at, requested_duration_hours, activation_deadline)
  values (v_practice_id, v_actor_id, v_requested_at, v_duration_hours, v_requested_at + interval '24 hours')
  returning id into v_grant_id;
  perform private.write_audit_event(v_practice_id, v_actor_id, v_actor_type, 'support_access_requested', 'allowed', 'support_access_grant', v_grant_id, v_grant_id);
  return v_grant_id;
end;
$$;

create or replace function public.activate_support_access(
  p_grant_id uuid,
  p_reason public.support_reason
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_type public.audit_actor_type;
  v_grant public.support_access_grant%rowtype;
  v_expires_at timestamptz;
begin
  if not private.has_current_aal2_session() then return null; end if;
  v_actor_type := private.audit_actor_type_for(v_actor_id);
  if not private.has_current_aal2_session(true) then
    perform private.write_audit_event(null, v_actor_id, v_actor_type, 'support_access_activated', 'denied', 'support_access_grant', p_grant_id);
    return null;
  end if;
  if p_grant_id is not null then
    select support_access_grant.* into v_grant from public.support_access_grant where id = p_grant_id for update;
  end if;
  if p_grant_id is null or p_reason is null or v_actor_type <> 'portal_admin' or not found
    or v_grant.activated_at is not null or v_grant.revoked_at is not null
    or v_grant.activation_deadline <= pg_catalog.now() then
    perform private.write_audit_event(null, v_actor_id, v_actor_type, 'support_access_activated', 'denied', 'support_access_grant', p_grant_id);
    return null;
  end if;
  v_expires_at := pg_catalog.now() + pg_catalog.make_interval(hours => v_grant.requested_duration_hours);
  update public.support_access_grant set activated_by = v_actor_id, activated_at = pg_catalog.now(), expires_at = v_expires_at, support_reason = p_reason where id = v_grant.id;
  perform private.write_audit_event(v_grant.practice_id, v_actor_id, v_actor_type, 'support_access_activated', 'allowed', 'support_access_grant', v_grant.id, v_grant.id);
  return pg_catalog.jsonb_build_object('practice_id', v_grant.practice_id, 'expires_at', v_expires_at);
end;
$$;

create or replace function public.revoke_support_access(p_grant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_type public.audit_actor_type;
  v_practice_id uuid;
  v_role public.user_role;
  v_grant public.support_access_grant%rowtype;
begin
  if not private.has_current_aal2_session() then return false; end if;
  v_actor_type := private.audit_actor_type_for(v_actor_id);
  select profile.practice_id, profile.role into v_practice_id, v_role from public.user_profile as profile where profile.user_id = v_actor_id;
  if not private.has_current_aal2_session(true) then
    perform private.write_audit_event(v_practice_id, v_actor_id, v_actor_type, 'support_access_revoked', 'denied', 'support_access_grant', p_grant_id);
    return false;
  end if;
  if p_grant_id is not null then select support_access_grant.* into v_grant from public.support_access_grant where id = p_grant_id for update; end if;
  if p_grant_id is null or v_role is distinct from 'praxisadmin' or not found
    or v_grant.practice_id <> v_practice_id or v_grant.revoked_at is not null then
    perform private.write_audit_event(v_practice_id, v_actor_id, v_actor_type, 'support_access_revoked', 'denied', 'support_access_grant', p_grant_id);
    return false;
  end if;
  update public.support_access_grant set revoked_at = pg_catalog.now() where id = v_grant.id;
  perform private.write_audit_event(v_grant.practice_id, v_actor_id, v_actor_type, 'support_access_revoked', 'allowed', 'support_access_grant', v_grant.id, v_grant.id);
  return true;
end;
$$;

create or replace function public.read_audit_events(
  p_practice_id uuid,
  p_before timestamptz,
  p_limit integer
)
returns table (
  event_id uuid, actor_type public.audit_actor_type, actor_id uuid,
  occurred_at timestamptz, action public.audit_action, outcome public.audit_outcome,
  resource_type text, resource_id uuid, correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_type public.audit_actor_type;
  v_known_practice_id uuid;
  v_grant_id uuid;
begin
  if not private.has_current_aal2_session() then return; end if;
  v_actor_type := private.audit_actor_type_for(v_actor_id);
  if not private.has_current_aal2_session(true) then perform public.record_denied_audit_read(); return; end if;
  if v_actor_type <> 'portal_admin' then perform public.record_denied_audit_read(); return; end if;
  if p_practice_id is not null then select practice.id into v_known_practice_id from public.practice as practice where practice.id = p_practice_id; end if;
  if v_known_practice_id is not null and p_before is not null and p_limit between 1 and 100 then
    select support_access_grant.id into v_grant_id from public.support_access_grant
    where practice_id = v_known_practice_id and activated_by = v_actor_id
      and activated_at is not null and revoked_at is null and expires_at > pg_catalog.now()
    order by activated_at desc, id desc limit 1 for update;
  end if;
  if v_grant_id is null then perform public.record_denied_audit_read(); return; end if;
  perform private.write_audit_event(v_known_practice_id, v_actor_id, v_actor_type, 'audit_read', 'allowed', 'support_access_grant', v_grant_id, pg_catalog.gen_random_uuid());
  return query select audit_event.id, audit_event.actor_type, audit_event.actor_id, audit_event.occurred_at, audit_event.action, audit_event.outcome, audit_event.resource_type, audit_event.resource_id, audit_event.correlation_id
  from public.audit_event where audit_event.practice_id = v_known_practice_id and audit_event.occurred_at <= p_before
  order by audit_event.occurred_at desc, audit_event.id desc limit p_limit;
end;
$$;
