create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create type public.audit_outcome as enum (
  'allowed',
  'denied',
  'failed'
);

create type public.audit_actor_type as enum (
  'practice_member',
  'portal_admin',
  'unknown_authenticated'
);

create type public.audit_action as enum (
  'support_access_requested',
  'support_access_activated',
  'support_access_revoked',
  'audit_read'
);

create type public.support_reason as enum (
  'technical_investigation',
  'account_support'
);

create table public.portal_admin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.support_access_grant (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practice(id) on delete cascade,
  requested_by uuid not null references public.user_profile(user_id) on delete restrict,
  activated_by uuid references public.portal_admin(user_id) on delete restrict,
  requested_at timestamptz not null default now(),
  requested_duration interval not null,
  activation_deadline timestamptz not null,
  activated_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  support_reason public.support_reason,
  constraint support_access_grant_requested_duration_check
    check (
      requested_duration > interval '0 hours'
      and requested_duration <= interval '24 hours'
    ),
  constraint support_access_grant_activation_deadline_check
    check (activation_deadline = requested_at + interval '24 hours'),
  constraint support_access_grant_activation_metadata_check
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
        and expires_at = activated_at + requested_duration
      )
    ),
  constraint support_access_grant_revocation_timestamp_check
    check (revoked_at is null or revoked_at >= requested_at)
);

create table public.audit_event (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references public.practice(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_type public.audit_actor_type not null,
  action public.audit_action not null,
  outcome public.audit_outcome not null,
  resource_type text not null,
  resource_id uuid,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null default gen_random_uuid(),
  constraint audit_event_practice_for_denial_only_check
    check (practice_id is not null or outcome = 'denied'),
  constraint audit_event_controlled_resource_type_check
    check (resource_type in ('support_access_grant', 'audit_event')),
  constraint audit_event_allowed_resource_reference_check
    check (outcome <> 'allowed' or resource_id is not null)
);

create index support_access_grant_practice_id_idx
  on public.support_access_grant (practice_id);

create index support_access_grant_active_portal_admin_idx
  on public.support_access_grant (activated_by, practice_id, expires_at)
  where activated_at is not null and revoked_at is null;

create index audit_event_practice_occurred_at_idx
  on public.audit_event (practice_id, occurred_at desc, id desc)
  where practice_id is not null;

create index audit_event_occurred_at_idx
  on public.audit_event (occurred_at);

alter table public.portal_admin enable row level security;
alter table public.support_access_grant enable row level security;
alter table public.audit_event enable row level security;

revoke all on table public.portal_admin from public, anon, authenticated;
revoke all on table public.support_access_grant from public, anon, authenticated;
revoke all on table public.audit_event from public, anon, authenticated;

grant select, insert, update, delete on table public.portal_admin to service_role;
grant select, insert, update, delete on table public.support_access_grant to service_role;
grant select, insert, update, delete on table public.audit_event to service_role;

create function private.audit_actor_type_for(p_actor_id uuid)
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

create function private.write_audit_event(
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

create function private.reject_portal_admin_practice_member_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  if exists (
    select 1
    from public.user_profile as profile
    where profile.user_id = new.user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'portal-admin identities cannot be practice members';
  end if;

  return new;
end;
$$;

create function private.reject_practice_member_portal_admin_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  if exists (
    select 1
    from public.portal_admin as portal_admin
    where portal_admin.user_id = new.user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'practice members cannot be portal-admin identities';
  end if;

  return new;
end;
$$;

create trigger portal_admin_reject_practice_member_overlap
before insert or update of user_id on public.portal_admin
for each row execute function private.reject_portal_admin_practice_member_overlap();

create trigger user_profile_reject_portal_admin_overlap
before insert or update of user_id on public.user_profile
for each row execute function private.reject_practice_member_portal_admin_overlap();

create function public.request_support_access(p_requested_duration interval default null)
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
  v_duration interval := coalesce(p_requested_duration, interval '8 hours');
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

  if v_duration <= interval '0 hours'
    or v_duration > interval '24 hours'
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
    requested_duration,
    activation_deadline
  )
  values (
    v_practice_id,
    v_actor_id,
    v_requested_at,
    v_duration,
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

create function public.activate_support_access(
  p_grant_id uuid,
  p_reason public.support_reason
)
returns timestamptz
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
      v_grant.practice_id,
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

  return v_expires_at;
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

create function public.read_audit_events(
  p_practice_id uuid,
  p_before timestamptz,
  p_limit integer
)
returns table (
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
      v_known_practice_id,
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

create extension if not exists pg_cron;

create function private.purge_expired_audit_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.audit_event
  where occurred_at <= pg_catalog.now() - interval '90 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.audit_actor_type_for(uuid) from public, anon, authenticated;
revoke all on function private.write_audit_event(uuid, uuid, public.audit_actor_type, public.audit_action, public.audit_outcome, text, uuid, uuid) from public, anon, authenticated;
revoke all on function private.reject_portal_admin_practice_member_overlap() from public, anon, authenticated;
revoke all on function private.reject_practice_member_portal_admin_overlap() from public, anon, authenticated;
revoke all on function public.request_support_access(interval) from public, anon, authenticated;
revoke all on function public.activate_support_access(uuid, public.support_reason) from public, anon, authenticated;
revoke all on function public.revoke_support_access(uuid) from public, anon, authenticated;
revoke all on function public.read_audit_events(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function private.purge_expired_audit_events() from public, anon, authenticated;

grant execute on function public.request_support_access(interval) to authenticated;
grant execute on function public.activate_support_access(uuid, public.support_reason) to authenticated;
grant execute on function public.revoke_support_access(uuid) to authenticated;
grant execute on function public.read_audit_events(uuid, timestamptz, integer) to authenticated;
grant execute on function private.purge_expired_audit_events() to service_role;

select cron.schedule(
  'dentpilot-purge-expired-audit-events',
  '17 3 * * *',
  $$select private.purge_expired_audit_events();$$
);
