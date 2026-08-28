create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create type public.audit_outcome as enum (
  'allowed',
  'denied',
  'failed'
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
  activated_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  support_reason public.support_reason,
  constraint support_access_grant_duration_check
    check (
      expires_at > requested_at
      and expires_at <= requested_at + interval '24 hours'
    ),
  constraint support_access_grant_activation_metadata_check
    check (
      (activated_at is null and activated_by is null and support_reason is null)
      or (activated_at is not null and activated_by is not null and support_reason is not null)
    ),
  constraint support_access_grant_revocation_timestamp_check
    check (revoked_at is null or revoked_at >= requested_at)
);

create table public.audit_event (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references public.practice(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
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

create function private.reject_portal_admin_practice_member_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
  v_practice_id uuid;
  v_duration interval := coalesce(p_requested_duration, interval '8 hours');
  v_grant_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  if v_duration <= interval '0 hours' or v_duration > interval '24 hours' then
    raise exception using errcode = '22023', message = 'invalid support-access duration';
  end if;

  select profile.practice_id
  into v_practice_id
  from public.user_profile as profile
  where profile.user_id = v_actor_id
    and profile.role = 'praxisadmin';

  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  insert into public.support_access_grant (
    practice_id,
    requested_by,
    expires_at
  )
  values (
    v_practice_id,
    v_actor_id,
    pg_catalog.now() + v_duration
  )
  returning id into v_grant_id;

  insert into public.audit_event (
    practice_id,
    actor_id,
    action,
    outcome,
    resource_type,
    resource_id,
    correlation_id
  )
  values (
    v_practice_id,
    v_actor_id,
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
  v_grant public.support_access_grant%rowtype;
begin
  if v_actor_id is null
    or p_grant_id is null
    or p_reason is null
    or not exists (
      select 1
      from public.portal_admin as portal_admin
      where portal_admin.user_id = v_actor_id
    ) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  select support_access_grant.*
  into v_grant
  from public.support_access_grant
  where id = p_grant_id
  for update;

  if not found
    or v_grant.activated_at is not null
    or v_grant.revoked_at is not null
    or v_grant.expires_at <= pg_catalog.now() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  update public.support_access_grant
  set activated_by = v_actor_id,
      activated_at = pg_catalog.now(),
      support_reason = p_reason
  where id = v_grant.id;

  insert into public.audit_event (
    practice_id,
    actor_id,
    action,
    outcome,
    resource_type,
    resource_id,
    correlation_id
  )
  values (
    v_grant.practice_id,
    v_actor_id,
    'support_access_activated',
    'allowed',
    'support_access_grant',
    v_grant.id,
    v_grant.id
  );

  return v_grant.expires_at;
end;
$$;

create function public.revoke_support_access(p_grant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_practice_id uuid;
  v_grant public.support_access_grant%rowtype;
begin
  if v_actor_id is null or p_grant_id is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  select profile.practice_id
  into v_practice_id
  from public.user_profile as profile
  where profile.user_id = v_actor_id
    and profile.role = 'praxisadmin';

  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  select support_access_grant.*
  into v_grant
  from public.support_access_grant
  where id = p_grant_id
    and practice_id = v_practice_id
  for update;

  if not found or v_grant.revoked_at is not null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  update public.support_access_grant
  set revoked_at = pg_catalog.now()
  where id = v_grant.id;

  insert into public.audit_event (
    practice_id,
    actor_id,
    action,
    outcome,
    resource_type,
    resource_id,
    correlation_id
  )
  values (
    v_grant.practice_id,
    v_actor_id,
    'support_access_revoked',
    'allowed',
    'support_access_grant',
    v_grant.id,
    v_grant.id
  );
end;
$$;

create function public.read_audit_events(
  p_practice_id uuid,
  p_before timestamptz,
  p_limit integer
)
returns table (
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
  v_grant_id uuid;
begin
  if v_actor_id is null
    or p_practice_id is null
    or p_before is null
    or p_limit is null
    or p_limit < 1
    or p_limit > 100
    or not exists (
      select 1
      from public.portal_admin as portal_admin
      where portal_admin.user_id = v_actor_id
    ) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  select support_access_grant.id
  into v_grant_id
  from public.support_access_grant
  where practice_id = p_practice_id
    and activated_by = v_actor_id
    and activated_at is not null
    and revoked_at is null
    and expires_at > pg_catalog.now()
  order by activated_at desc, id desc
  limit 1
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  insert into public.audit_event (
    practice_id,
    actor_id,
    action,
    outcome,
    resource_type,
    resource_id,
    correlation_id
  )
  values (
    p_practice_id,
    v_actor_id,
    'audit_read',
    'allowed',
    'support_access_grant',
    v_grant_id,
    pg_catalog.gen_random_uuid()
  );

  return query
  select
    audit_event.actor_id,
    audit_event.occurred_at,
    audit_event.action,
    audit_event.outcome,
    audit_event.resource_type,
    audit_event.resource_id,
    audit_event.correlation_id
  from public.audit_event
  where audit_event.practice_id = p_practice_id
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

revoke all on function private.reject_portal_admin_practice_member_overlap() from public;
revoke all on function private.reject_practice_member_portal_admin_overlap() from public;
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
