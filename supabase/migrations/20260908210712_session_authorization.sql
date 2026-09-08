-- T03: fail closed at the database authorization boundary. This predicate
-- deliberately returns only a boolean so callers cannot distinguish a bad
-- claim, revoked session, expiry, lock, or deleted account.
create or replace function private.has_current_aal2_session()
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

revoke all on function private.has_current_aal2_session()
  from public, anon, authenticated;
grant execute on function private.has_current_aal2_session() to authenticated;

alter policy "users can read only their own profile"
  on public.user_profile
  using (
    (select auth.uid()) = user_id
    and (select private.has_current_aal2_session())
  );

alter policy "users can read only their own practice"
  on public.practice
  using (
    (select private.has_current_aal2_session())
    and exists (
      select 1
      from public.user_profile
      where user_profile.practice_id = practice.id
        and user_profile.user_id = (select auth.uid())
    )
  );

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
  if not private.has_current_aal2_session() then
    return null;
  end if;

  v_actor_type := private.audit_actor_type_for(v_actor_id);

  select profile.practice_id, profile.role
  into v_practice_id, v_role
  from public.user_profile as profile
  where profile.user_id = v_actor_id;

  if v_duration_hours not between 1 and 24
    or v_role is distinct from 'praxisadmin' then
    perform private.write_audit_event(
      v_practice_id,
      v_actor_id,
      v_actor_type,
      'support_access_requested',
      'denied',
      'support_access_grant',
      null
    );
    return null;
  end if;

  insert into public.support_access_grant (
    practice_id,
    requested_by,
    requested_at,
    requested_duration_hours,
    activation_deadline
  )
  values (
    v_practice_id,
    v_actor_id,
    v_requested_at,
    v_duration_hours,
    v_requested_at + interval '24 hours'
  )
  returning id into v_grant_id;

  perform private.write_audit_event(
    v_practice_id,
    v_actor_id,
    v_actor_type,
    'support_access_requested',
    'allowed',
    'support_access_grant',
    v_grant_id,
    v_grant_id
  );

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
  if not private.has_current_aal2_session() then
    return null;
  end if;

  v_actor_type := private.audit_actor_type_for(v_actor_id);

  if p_grant_id is not null then
    select support_access_grant.*
    into v_grant
    from public.support_access_grant
    where id = p_grant_id
    for update;
  end if;

  if p_grant_id is null
    or p_reason is null
    or v_actor_type <> 'portal_admin'
    or not found
    or v_grant.activated_at is not null
    or v_grant.revoked_at is not null
    or v_grant.activation_deadline <= pg_catalog.now() then
    perform private.write_audit_event(
      null,
      v_actor_id,
      v_actor_type,
      'support_access_activated',
      'denied',
      'support_access_grant',
      p_grant_id
    );
    return null;
  end if;

  v_expires_at := pg_catalog.now()
    + pg_catalog.make_interval(hours => v_grant.requested_duration_hours);

  update public.support_access_grant
  set activated_by = v_actor_id,
      activated_at = pg_catalog.now(),
      expires_at = v_expires_at,
      support_reason = p_reason
  where id = v_grant.id;

  perform private.write_audit_event(
    v_grant.practice_id,
    v_actor_id,
    v_actor_type,
    'support_access_activated',
    'allowed',
    'support_access_grant',
    v_grant.id,
    v_grant.id
  );

  return pg_catalog.jsonb_build_object(
    'practice_id', v_grant.practice_id,
    'expires_at', v_expires_at
  );
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
  if not private.has_current_aal2_session() then
    return false;
  end if;

  v_actor_type := private.audit_actor_type_for(v_actor_id);

  select profile.practice_id, profile.role
  into v_practice_id, v_role
  from public.user_profile as profile
  where profile.user_id = v_actor_id;

  if p_grant_id is not null then
    select support_access_grant.*
    into v_grant
    from public.support_access_grant
    where id = p_grant_id
    for update;
  end if;

  if p_grant_id is null
    or v_role is distinct from 'praxisadmin'
    or not found
    or v_grant.practice_id <> v_practice_id
    or v_grant.revoked_at is not null then
    perform private.write_audit_event(
      v_practice_id,
      v_actor_id,
      v_actor_type,
      'support_access_revoked',
      'denied',
      'support_access_grant',
      p_grant_id
    );
    return false;
  end if;

  update public.support_access_grant
  set revoked_at = pg_catalog.now()
  where id = v_grant.id;

  perform private.write_audit_event(
    v_grant.practice_id,
    v_actor_id,
    v_actor_type,
    'support_access_revoked',
    'allowed',
    'support_access_grant',
    v_grant.id,
    v_grant.id
  );

  return true;
end;
$$;

create or replace function public.read_audit_events(
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
declare
  v_actor_id uuid := auth.uid();
  v_actor_type public.audit_actor_type;
  v_known_practice_id uuid;
  v_grant_id uuid;
begin
  if not private.has_current_aal2_session() then
    return;
  end if;

  v_actor_type := private.audit_actor_type_for(v_actor_id);

  if v_actor_type <> 'portal_admin' then
    perform public.record_denied_audit_read();
    return;
  end if;

  if p_practice_id is not null then
    select practice.id
    into v_known_practice_id
    from public.practice as practice
    where practice.id = p_practice_id;
  end if;

  if v_known_practice_id is not null
    and p_before is not null
    and p_limit between 1 and 100 then
    select support_access_grant.id
    into v_grant_id
    from public.support_access_grant
    where practice_id = v_known_practice_id
      and activated_by = v_actor_id
      and activated_at is not null
      and revoked_at is null
      and expires_at > pg_catalog.now()
    order by activated_at desc, id desc
    limit 1
    for update;
  end if;

  if v_grant_id is null then
    perform public.record_denied_audit_read();
    return;
  end if;

  perform private.write_audit_event(
    v_known_practice_id,
    v_actor_id,
    v_actor_type,
    'audit_read',
    'allowed',
    'support_access_grant',
    v_grant_id,
    pg_catalog.gen_random_uuid()
  );

  return query
  select
    audit_event.id,
    audit_event.actor_type,
    audit_event.actor_id,
    audit_event.occurred_at,
    audit_event.action,
    audit_event.outcome,
    audit_event.resource_type,
    audit_event.resource_id,
    audit_event.correlation_id
  from public.audit_event
  where audit_event.practice_id = v_known_practice_id
    and audit_event.occurred_at <= p_before
  order by audit_event.occurred_at desc, audit_event.id desc
  limit p_limit;
end;
$$;

create or replace function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_current_aal2_session()
    and auth.uid() is not null
    and exists (
      select 1
      from public.portal_admin as portal_admin
      where portal_admin.user_id = auth.uid()
    );
$$;

-- The no-target denied-audit writer stays available to trusted definer
-- functions only, so denied reads retain their neutral audit behavior without
-- becoming a direct browser RPC surface.
revoke all on function public.record_denied_audit_read()
  from public, anon, authenticated;
