-- Bridges the exact original PROJ-19 state from 586ebf5 before the later
-- 20260829 migrations require duration and actor metadata. It is intentionally
-- safe to reapply against the already-modernized historical shape.

do $bridge$
declare
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

  if v_has_bounded_duration then
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
      message = 'support access duration schema is incompatible';
  end if;
end;
$bridge$;

alter table public.support_access_grant
  alter column requested_duration_hours set not null;
alter table public.support_access_grant
  alter column activation_deadline set not null;
alter table public.support_access_grant
  alter column expires_at drop not null;
alter table public.support_access_grant
  drop constraint if exists support_access_grant_duration_check;
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

grant execute on function public.record_denied_audit_read()
  to authenticated;
