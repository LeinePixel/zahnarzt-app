-- Converges databases that already recorded the original PROJ-19 migrations
-- with fresh installations whose historical migrations already contain the
-- hardened shape. Historical migration files intentionally remain unchanged.

drop function if exists public.request_support_access(interval);

do $migration$
declare
  v_has_legacy_duration boolean;
  v_has_bounded_duration boolean;
begin
  select exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'support_access_grant'
      and attribute.attname = 'requested_duration'
      and not attribute.attisdropped
  )
  into v_has_legacy_duration;

  select exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'support_access_grant'
      and attribute.attname = 'requested_duration_hours'
      and not attribute.attisdropped
  )
  into v_has_bounded_duration;

  if v_has_legacy_duration and v_has_bounded_duration then
    raise exception using
      errcode = '55000',
      message = 'support access duration schema is ambiguous';
  elsif v_has_legacy_duration then
    alter table public.support_access_grant
      add column requested_duration_hours smallint;

    update public.support_access_grant
    set requested_duration_hours = case
          when extract(year from requested_duration) = 0
            and extract(month from requested_duration) = 0
            and extract(day from requested_duration) = 0
            and extract(epoch from requested_duration)
              between 3600 and 86400
            and mod(
              extract(epoch from requested_duration),
              3600
            ) = 0
          then (
            extract(epoch from requested_duration) / 3600
          )::smallint
          else 1
        end,
        revoked_at = case
          when extract(year from requested_duration) = 0
            and extract(month from requested_duration) = 0
            and extract(day from requested_duration) = 0
            and extract(epoch from requested_duration)
              between 3600 and 86400
            and mod(
              extract(epoch from requested_duration),
              3600
            ) = 0
          then revoked_at
          else greatest(
            coalesce(revoked_at, pg_catalog.now()),
            requested_at
          )
        end;

    alter table public.support_access_grant
      drop constraint if exists support_access_grant_requested_duration_check;
    alter table public.support_access_grant
      drop constraint if exists support_access_grant_activation_metadata_check;

    update public.support_access_grant
    set expires_at = activated_at + pg_catalog.make_interval(
      hours => requested_duration_hours
    )
    where activated_at is not null;

    alter table public.support_access_grant
      alter column requested_duration_hours set not null;
    alter table public.support_access_grant
      drop column requested_duration;
    alter table public.support_access_grant
      add constraint support_access_grant_requested_duration_hours_check
        check (requested_duration_hours between 1 and 24);
    alter table public.support_access_grant
      add constraint support_access_grant_activation_metadata_check
        check (
          (
            activated_at is null
            and activated_by is null
            and support_reason is null
            and expires_at is null
          )
          or (
            activated_at is not null
            and activated_by is not null
            and support_reason is not null
            and expires_at = activated_at
              + pg_catalog.make_interval(hours => requested_duration_hours)
          )
        );
  elsif not v_has_bounded_duration then
    raise exception using
      errcode = '55000',
      message = 'support access duration schema is missing';
  end if;
end;
$migration$;

create or replace function public.record_denied_audit_read()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_type public.audit_actor_type;
  v_practice_id uuid;
begin
  if v_actor_id is null then
    return false;
  end if;

  v_actor_type := private.audit_actor_type_for(v_actor_id);

  if v_actor_type = 'practice_member' then
    select profile.practice_id
    into v_practice_id
    from public.user_profile as profile
    where profile.user_id = v_actor_id;
  end if;

  perform private.write_audit_event(
    v_practice_id,
    v_actor_id,
    v_actor_type,
    'audit_read',
    'denied',
    'audit_event',
    null
  );

  return false;
end;
$$;

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
  if v_actor_id is null then
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
  if v_actor_id is null then
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

revoke all on function public.record_denied_audit_read()
  from public, anon, authenticated;
revoke all on function public.request_support_access(integer)
  from public, anon, authenticated;
revoke all on function public.activate_support_access(uuid, public.support_reason)
  from public, anon, authenticated;
revoke all on function public.read_audit_events(uuid, timestamptz, integer)
  from public, anon, authenticated;

grant execute on function public.record_denied_audit_read()
  to authenticated;
grant execute on function public.request_support_access(integer)
  to authenticated;
grant execute on function public.activate_support_access(uuid, public.support_reason)
  to authenticated;
grant execute on function public.read_audit_events(uuid, timestamptz, integer)
  to authenticated;
