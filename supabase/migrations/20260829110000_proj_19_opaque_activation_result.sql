-- Keeps provider activation opaque while returning only the practice newly
-- authorized by that exact grant. No listing or discovery endpoint is added.

drop function public.activate_support_access(uuid, public.support_reason);

create function public.activate_support_access(
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
  if v_actor_id is null then
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

  v_expires_at := pg_catalog.now() + v_grant.requested_duration;

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

drop function public.read_audit_events(uuid, timestamptz, integer);

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
declare
  v_actor_id uuid := auth.uid();
  v_actor_type public.audit_actor_type;
  v_known_practice_id uuid;
  v_grant_id uuid;
begin
  if v_actor_id is null then
    return;
  end if;

  v_actor_type := private.audit_actor_type_for(v_actor_id);

  if p_practice_id is not null then
    select practice.id
    into v_known_practice_id
    from public.practice as practice
    where practice.id = p_practice_id;
  end if;

  if v_actor_type = 'portal_admin'
    and v_known_practice_id is not null
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
    perform private.write_audit_event(
      null,
      v_actor_id,
      v_actor_type,
      'audit_read',
      'denied',
      'audit_event',
      null
    );
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

revoke all on function public.activate_support_access(uuid, public.support_reason) from public, anon, authenticated;
revoke all on function public.read_audit_events(uuid, timestamptz, integer) from public, anon, authenticated;

grant execute on function public.activate_support_access(uuid, public.support_reason) to authenticated;
grant execute on function public.read_audit_events(uuid, timestamptz, integer) to authenticated;
