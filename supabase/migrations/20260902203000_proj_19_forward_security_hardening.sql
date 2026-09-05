-- Converges databases that already recorded the original PROJ-19 migrations
-- with fresh installations whose historical migrations already contain the
-- hardened shape. Historical migration files intentionally remain unchanged.

drop function if exists public.request_support_access(interval);
drop function if exists public.activate_support_access(uuid, public.support_reason);
drop function if exists public.revoke_support_access(uuid);
drop function if exists public.read_audit_events(uuid, timestamptz, integer);
drop function if exists public.is_portal_admin();

do $migration$
declare
  v_has_legacy_duration boolean;
  v_has_bounded_duration boolean;
  v_has_activation_deadline boolean;
  v_has_original_expires_only_schema boolean;
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

  select exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'support_access_grant'
      and attribute.attname = 'activation_deadline'
      and not attribute.attisdropped
  )
  into v_has_activation_deadline;

  select
    count(*) = 9
    and count(*) filter (
      where attribute.attname in (
        'id',
        'practice_id',
        'requested_by',
        'requested_at',
        'activated_by',
        'activated_at',
        'expires_at',
        'revoked_at',
        'support_reason'
      )
    ) = 9
    and bool_or(
      attribute.attname = 'expires_at'
      and attribute.attnotnull
      and attribute.atttypid = 'timestamp with time zone'::pg_catalog.regtype
    )
  into v_has_original_expires_only_schema
  from pg_catalog.pg_attribute as attribute
  join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'support_access_grant'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if v_has_legacy_duration and v_has_bounded_duration then
    raise exception using
      errcode = '55000',
      message = 'support access duration schema is ambiguous';
  elsif v_has_legacy_duration then
    if not v_has_activation_deadline then
      raise exception using
        errcode = '55000',
        message = 'legacy support access duration schema is incomplete';
    end if;

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
  elsif v_has_bounded_duration then
    if not v_has_activation_deadline then
      raise exception using
        errcode = '55000',
        message = 'bounded support access duration schema is incomplete';
    end if;
  elsif v_has_original_expires_only_schema and not v_has_activation_deadline then
    alter table public.support_access_grant
      drop constraint if exists support_access_grant_duration_check;
    alter table public.support_access_grant
      drop constraint if exists support_access_grant_activation_metadata_check;
    alter table public.support_access_grant
      alter column expires_at drop not null;
    alter table public.support_access_grant
      add column requested_duration_hours smallint;
    alter table public.support_access_grant
      add column activation_deadline timestamptz;

    with normalized_grants as (
      select
        support_access_grant.id,
        case
          when extract(epoch from (
            support_access_grant.expires_at - support_access_grant.requested_at
          )) between 3600 and 86400
            and mod(
              extract(epoch from (
                support_access_grant.expires_at - support_access_grant.requested_at
              )),
              3600
            ) = 0
          then (
            extract(epoch from (
              support_access_grant.expires_at - support_access_grant.requested_at
            )) / 3600
          )::smallint
          else 1
        end as requested_duration_hours
      from public.support_access_grant
    )
    update public.support_access_grant
    set requested_duration_hours = normalized_grants.requested_duration_hours,
        activation_deadline = support_access_grant.requested_at
          + interval '24 hours',
        expires_at = case
          when support_access_grant.activated_at is null then null
          else support_access_grant.activated_at + pg_catalog.make_interval(
            hours => normalized_grants.requested_duration_hours
          )
        end,
        revoked_at = greatest(
          coalesce(support_access_grant.revoked_at, pg_catalog.now()),
          support_access_grant.requested_at
        )
    from normalized_grants
    where support_access_grant.id = normalized_grants.id;
  else
    raise exception using
      errcode = '55000',
      message = 'support access duration schema is missing';
  end if;
end;
$migration$;

alter table public.support_access_grant
  alter column requested_duration_hours set not null;
alter table public.support_access_grant
  alter column activation_deadline set not null;
alter table public.support_access_grant
  alter column expires_at drop not null;
alter table public.support_access_grant
  drop constraint if exists support_access_grant_duration_check;
alter table public.support_access_grant
  drop constraint if exists support_access_grant_requested_duration_check;
alter table public.support_access_grant
  drop constraint if exists support_access_grant_requested_duration_hours_check;
alter table public.support_access_grant
  drop constraint if exists support_access_grant_activation_deadline_check;
alter table public.support_access_grant
  drop constraint if exists support_access_grant_activation_metadata_check;
alter table public.support_access_grant
  drop constraint if exists support_access_grant_revocation_timestamp_check;
alter table public.support_access_grant
  add constraint support_access_grant_requested_duration_hours_check
    check (requested_duration_hours between 1 and 24);
alter table public.support_access_grant
  add constraint support_access_grant_activation_deadline_check
    check (activation_deadline = requested_at + interval '24 hours');
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
alter table public.support_access_grant
  add constraint support_access_grant_revocation_timestamp_check
    check (revoked_at is null or revoked_at >= requested_at);

do $audit_actor$
declare
  v_actor_type_oid oid;
  v_has_actor_type_column boolean;
begin
  select type.oid
  into v_actor_type_oid
  from pg_catalog.pg_type as type
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = type.typnamespace
  where namespace.nspname = 'public'
    and type.typname = 'audit_actor_type';

  if v_actor_type_oid is null then
    execute $$
      create type public.audit_actor_type as enum (
        'practice_member',
        'portal_admin',
        'unknown_authenticated'
      )
    $$;

    select type.oid
    into v_actor_type_oid
    from pg_catalog.pg_type as type
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = type.typnamespace
    where namespace.nspname = 'public'
      and type.typname = 'audit_actor_type';
  elsif not (
    select array_agg(enum_value.enumlabel::text order by enum_value.enumsortorder)
      = array['practice_member', 'portal_admin', 'unknown_authenticated']::text[]
    from pg_catalog.pg_enum as enum_value
    where enum_value.enumtypid = v_actor_type_oid
  ) then
    raise exception using
      errcode = '55000',
      message = 'audit actor type schema is incompatible';
  end if;

  select exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'audit_event'
      and attribute.attname = 'actor_type'
      and not attribute.attisdropped
  )
  into v_has_actor_type_column;

  if not v_has_actor_type_column then
    alter table public.audit_event
      add column actor_type public.audit_actor_type;
  elsif exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    join pg_catalog.pg_class as relation on relation.oid = attribute.attrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'audit_event'
      and attribute.attname = 'actor_type'
      and not attribute.attisdropped
      and attribute.atttypid <> v_actor_type_oid
  ) then
    raise exception using
      errcode = '55000',
      message = 'audit event actor type column is incompatible';
  end if;

  update public.audit_event
  set actor_type = case
        when exists (
          select 1
          from public.portal_admin as portal_admin
          where portal_admin.user_id = audit_event.actor_id
        ) then 'portal_admin'::public.audit_actor_type
        when exists (
          select 1
          from public.user_profile as profile
          where profile.user_id = audit_event.actor_id
        ) then 'practice_member'::public.audit_actor_type
        else 'unknown_authenticated'::public.audit_actor_type
      end
  where actor_type is null;

  if exists (
    select 1
    from public.audit_event
    where actor_type is null
  ) then
    raise exception using
      errcode = '55000',
      message = 'audit event actor type backfill is incomplete';
  end if;

  alter table public.audit_event
    alter column actor_type set not null;
end;
$audit_actor$;

alter table public.portal_admin enable row level security;
alter table public.support_access_grant enable row level security;
alter table public.audit_event enable row level security;

revoke all on table public.portal_admin from public, anon, authenticated;
revoke all on table public.support_access_grant from public, anon, authenticated;
revoke all on table public.audit_event from public, anon, authenticated;

grant select, insert, update, delete on table public.portal_admin to service_role;
grant select, insert, update, delete on table public.support_access_grant to service_role;
grant select, insert, update, delete on table public.audit_event to service_role;

create or replace function private.audit_actor_type_for(p_actor_id uuid)
returns public.audit_actor_type
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.portal_admin as portal_admin
    where portal_admin.user_id = p_actor_id
  ) then
    return 'portal_admin';
  end if;

  if exists (
    select 1
    from public.user_profile as profile
    where profile.user_id = p_actor_id
  ) then
    return 'practice_member';
  end if;

  return 'unknown_authenticated';
end;
$$;

create or replace function private.write_audit_event(
  p_practice_id uuid,
  p_actor_id uuid,
  p_actor_type public.audit_actor_type,
  p_action public.audit_action,
  p_outcome public.audit_outcome,
  p_resource_type text,
  p_resource_id uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null then
    raise exception using errcode = '22023', message = 'invalid audit actor';
  end if;

  insert into public.audit_event (
    practice_id,
    actor_id,
    actor_type,
    action,
    outcome,
    resource_type,
    resource_id,
    correlation_id
  )
  values (
    p_practice_id,
    p_actor_id,
    p_actor_type,
    p_action,
    p_outcome,
    p_resource_type,
    p_resource_id,
    coalesce(p_correlation_id, pg_catalog.gen_random_uuid())
  );
end;
$$;

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

create function public.revoke_support_access(p_grant_id uuid)
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
  if v_actor_id is null then
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

create function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.portal_admin as portal_admin
      where portal_admin.user_id = auth.uid()
    );
$$;

revoke all on function private.audit_actor_type_for(uuid)
  from public, anon, authenticated;
revoke all on function private.write_audit_event(
  uuid,
  uuid,
  public.audit_actor_type,
  public.audit_action,
  public.audit_outcome,
  text,
  uuid,
  uuid
) from public, anon, authenticated;
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
