do $$
begin
  if not exists(select 1 from pg_catalog.pg_roles where rolname = 'dentpilot_appointment_sync_executor') then
    create role dentpilot_appointment_sync_executor nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
  elsif exists(
    select 1 from pg_catalog.pg_roles
    where rolname = 'dentpilot_appointment_sync_executor'
      and (rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)
  ) then
    raise exception 'Invalid appointment sync group configuration';
  end if;
end;
$$;

create type public.appointment_status as enum ('confirmed', 'cancelled', 'no_show', 'rescheduled', 'completed');

alter table public.patient
  add constraint patient_id_integration_practice_unique unique(id, integration_id, practice_id);

create table public.appointment (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practice(id) on delete cascade,
  integration_id uuid not null,
  source_id text not null check(length(source_id) between 1 and 100),
  source_version integer not null check(source_version > 0),
  patient_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at > starts_at),
  status public.appointment_status not null,
  practitioner_source_id text not null check(length(practitioner_source_id) between 1 and 100),
  source_created_at timestamptz not null,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint appointment_integration_source_unique unique(integration_id, source_id),
  foreign key(integration_id, practice_id) references public.integration(id, practice_id) on delete cascade,
  foreign key(patient_id, integration_id, practice_id) references public.patient(id, integration_id, practice_id) on delete restrict
);
create index appointment_practice on public.appointment(practice_id);
create index appointment_integration_starts_at on public.appointment(integration_id, starts_at);
create index appointment_patient_starts_at on public.appointment(integration_id, patient_id, starts_at);

create table private.appointment_source_version (
  integration_id uuid not null,
  practice_id uuid not null,
  source_id text not null check(length(source_id) between 1 and 100),
  source_version integer not null check(source_version > 0),
  is_deleted boolean not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(integration_id, source_id),
  foreign key(integration_id, practice_id) references public.integration(id, practice_id) on delete cascade
);

create table private.appointment_sync_checkpoint (
  integration_id uuid primary key,
  practice_id uuid not null,
  initial_import_completed boolean not null default false,
  confirmed_change_cursor text check(length(confirmed_change_cursor) between 1 and 128),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key(integration_id, practice_id) references public.integration(id, practice_id) on delete cascade
);

create table private.appointment_sync_executor (
  database_role name primary key,
  integration_id uuid not null,
  practice_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(integration_id, practice_id) references public.integration(id, practice_id) on delete cascade
);

alter table public.appointment enable row level security;
alter table private.appointment_source_version enable row level security;
alter table private.appointment_sync_checkpoint enable row level security;
alter table private.appointment_sync_executor enable row level security;

revoke all on public.appointment from public, anon, authenticated, dentpilot_patient_sync_executor, dentpilot_appointment_sync_executor;
revoke all on private.appointment_source_version, private.appointment_sync_checkpoint, private.appointment_sync_executor
  from public, anon, authenticated, dentpilot_patient_sync_executor, dentpilot_appointment_sync_executor;
grant all on public.appointment to service_role;
grant all on private.appointment_source_version, private.appointment_sync_checkpoint, private.appointment_sync_executor to service_role;
grant usage on schema private to dentpilot_appointment_sync_executor;

create function private.initialize_appointment_sync_checkpoint() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.appointment_sync_checkpoint(integration_id, practice_id)
  values(new.id, new.practice_id) on conflict(integration_id) do nothing;
  return new;
end;
$$;
revoke all on function private.initialize_appointment_sync_checkpoint() from public, anon, authenticated, service_role, dentpilot_patient_sync_executor, dentpilot_appointment_sync_executor;
create trigger initialize_appointment_sync_checkpoint after insert on public.integration
for each row execute function private.initialize_appointment_sync_checkpoint();
insert into private.appointment_sync_checkpoint(integration_id, practice_id)
select id, practice_id from public.integration on conflict(integration_id) do nothing;

create function private.appointment_sync_identity()
returns table(integration_id uuid, practice_id uuid)
language sql security definer set search_path = '' stable as $$
  select e.integration_id, e.practice_id
  from private.appointment_sync_executor e
  join pg_catalog.pg_roles r on r.rolname = session_user
  where e.database_role = session_user::name
    and pg_catalog.pg_has_role(session_user, 'dentpilot_appointment_sync_executor', 'member')
    and r.rolcanlogin and not r.rolsuper and not r.rolbypassrls
    and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication
$$;

create function private.appointment_sync_has_lock(p_integration_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists(
    select 1 from pg_catalog.pg_locks
    where locktype = 'advisory' and pid = pg_catalog.pg_backend_pid()
      and classid = 20260914::oid
      and objid = (pg_catalog.hashtext(p_integration_id::text)::bit(32)::bigint)::oid
      and objsubid = 2 and granted
  )
$$;

create function private.apply_appointment_sync_mutation(p_integration_id uuid, p_practice_id uuid, p_mutation jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_operation text; v_source_id text; v_version integer; v_appointment jsonb;
  v_patient_source_id text; v_patient_id uuid;
  v_stored private.appointment_source_version%rowtype; v_existing public.appointment%rowtype;
begin
  if jsonb_typeof(p_mutation) is distinct from 'object' then
    raise exception 'Invalid appointment sync input' using errcode = 'P4001';
  end if;
  v_operation := p_mutation->>'operation';
  if v_operation = 'upsert' then
    if (select array_agg(key order by key) from jsonb_object_keys(p_mutation) key) <> array['appointment','operation'] then
      raise exception 'Invalid appointment sync input' using errcode = 'P4001';
    end if;
    v_appointment := p_mutation->'appointment';
    if jsonb_typeof(v_appointment) is distinct from 'object'
      or (select array_agg(key order by key) from jsonb_object_keys(v_appointment) key) <> array['endsAt','patientSourceId','practitionerSourceId','sourceCreatedAt','sourceId','sourceUpdatedAt','sourceVersion','startsAt','status']
    then
      raise exception 'Invalid appointment sync input' using errcode = 'P4001';
    end if;
    v_source_id := v_appointment->>'sourceId';
    v_patient_source_id := v_appointment->>'patientSourceId';
    if jsonb_typeof(v_appointment->'sourceVersion') is distinct from 'number'
      or not (v_appointment->>'sourceVersion' ~ '^[1-9][0-9]*$') then
      raise exception 'Invalid appointment sync input' using errcode = 'P4001';
    end if;
    v_version := (v_appointment->>'sourceVersion')::integer;
    if jsonb_typeof(v_appointment->'sourceId') is distinct from 'string'
      or jsonb_typeof(v_appointment->'patientSourceId') is distinct from 'string'
      or v_source_id is null or v_patient_source_id is null or length(v_source_id) not between 1 and 100
      or length(v_patient_source_id) not between 1 and 100 or v_version < 1
      or jsonb_typeof(v_appointment->'startsAt') is distinct from 'string'
      or jsonb_typeof(v_appointment->'endsAt') is distinct from 'string'
      or jsonb_typeof(v_appointment->'status') is distinct from 'string'
      or jsonb_typeof(v_appointment->'practitionerSourceId') is distinct from 'string'
      or jsonb_typeof(v_appointment->'sourceCreatedAt') is distinct from 'string'
      or jsonb_typeof(v_appointment->'sourceUpdatedAt') is distinct from 'string'
      or length(v_appointment->>'practitionerSourceId') not between 1 and 100
      or v_appointment->>'status' not in ('confirmed', 'cancelled', 'no_show', 'rescheduled', 'completed')
      or not (v_appointment->>'startsAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$')
      or not (v_appointment->>'endsAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$')
      or not (v_appointment->>'sourceCreatedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$')
      or not (v_appointment->>'sourceUpdatedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$')
    then
      raise exception 'Invalid appointment sync input' using errcode = 'P4001';
    end if;
    perform (v_appointment->>'startsAt')::timestamptz, (v_appointment->>'endsAt')::timestamptz,
      (v_appointment->>'sourceCreatedAt')::timestamptz, (v_appointment->>'sourceUpdatedAt')::timestamptz;
    if (v_appointment->>'endsAt')::timestamptz <= (v_appointment->>'startsAt')::timestamptz then
      raise exception 'Invalid appointment sync input' using errcode = 'P4001';
    end if;
  elsif v_operation = 'delete' then
    if (select array_agg(key order by key) from jsonb_object_keys(p_mutation) key) <> array['operation','sourceId','sourceVersion']
      or jsonb_typeof(p_mutation->'sourceVersion') is distinct from 'number'
      or not (p_mutation->>'sourceVersion' ~ '^[1-9][0-9]*$') then
      raise exception 'Invalid appointment sync input' using errcode = 'P4001';
    end if;
    v_source_id := p_mutation->>'sourceId';
    v_version := (p_mutation->>'sourceVersion')::integer;
    if jsonb_typeof(p_mutation->'sourceId') is distinct from 'string'
      or v_source_id is null or length(v_source_id) not between 1 and 100 or v_version < 1 then
      raise exception 'Invalid appointment sync input' using errcode = 'P4001';
    end if;
  else
    raise exception 'Invalid appointment sync input' using errcode = 'P4001';
  end if;

  select * into v_stored from private.appointment_source_version
  where integration_id = p_integration_id and source_id = v_source_id for update;
  if found and v_version < v_stored.source_version then return; end if;
  if found and v_version = v_stored.source_version then
    if v_operation = 'delete' and v_stored.is_deleted then return; end if;
    if v_operation = 'upsert' and not v_stored.is_deleted then
      select * into v_existing from public.appointment
      where integration_id = p_integration_id and source_id = v_source_id;
      select p.id into v_patient_id from public.patient p
      where p.integration_id = p_integration_id and p.practice_id = p_practice_id and p.source_id = v_patient_source_id
      for key share;
      if found and v_existing.patient_id = v_patient_id and (v_existing.source_version, v_existing.starts_at, v_existing.ends_at, v_existing.status::text, v_existing.practitioner_source_id, v_existing.source_created_at, v_existing.source_updated_at)
        is not distinct from (v_version, (v_appointment->>'startsAt')::timestamptz, (v_appointment->>'endsAt')::timestamptz, v_appointment->>'status', v_appointment->>'practitionerSourceId', (v_appointment->>'sourceCreatedAt')::timestamptz, (v_appointment->>'sourceUpdatedAt')::timestamptz)
      then return; end if;
    end if;
    raise exception 'Invalid appointment sync input' using errcode = 'P4001';
  end if;

  if v_operation = 'delete' then
    delete from public.appointment where integration_id = p_integration_id and source_id = v_source_id;
  else
    select p.id into v_patient_id from public.patient p
    where p.integration_id = p_integration_id and p.practice_id = p_practice_id and p.source_id = v_patient_source_id
    for key share;
    if v_patient_id is null then
      raise exception 'Invalid appointment sync input' using errcode = 'P4001';
    end if;
    insert into public.appointment(practice_id, integration_id, source_id, source_version, patient_id, starts_at, ends_at, status, practitioner_source_id, source_created_at, source_updated_at)
    values(p_practice_id, p_integration_id, v_source_id, v_version, v_patient_id, (v_appointment->>'startsAt')::timestamptz, (v_appointment->>'endsAt')::timestamptz, (v_appointment->>'status')::public.appointment_status, v_appointment->>'practitionerSourceId', (v_appointment->>'sourceCreatedAt')::timestamptz, (v_appointment->>'sourceUpdatedAt')::timestamptz)
    on conflict(integration_id, source_id) do update set source_version = excluded.source_version, patient_id = excluded.patient_id,
      starts_at = excluded.starts_at, ends_at = excluded.ends_at, status = excluded.status,
      practitioner_source_id = excluded.practitioner_source_id, source_created_at = excluded.source_created_at,
      source_updated_at = excluded.source_updated_at, updated_at = clock_timestamp();
  end if;
  insert into private.appointment_source_version(integration_id, practice_id, source_id, source_version, is_deleted, updated_at)
  values(p_integration_id, p_practice_id, v_source_id, v_version, v_operation = 'delete', clock_timestamp())
  on conflict(integration_id, source_id) do update set source_version = excluded.source_version,
    is_deleted = excluded.is_deleted, updated_at = excluded.updated_at;
exception when sqlstate '22007' or sqlstate '22P02' or sqlstate '22003' or foreign_key_violation then
  raise exception 'Invalid appointment sync input' using errcode = 'P4001';
end;
$$;

create function private.acquire_appointment_sync() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_integration uuid; v_practice uuid; v_checkpoint private.appointment_sync_checkpoint%rowtype; v_next timestamptz;
begin
  select e.integration_id, e.practice_id into v_integration, v_practice
  from private.appointment_sync_executor e join pg_catalog.pg_roles r on r.rolname = session_user
  where e.database_role = session_user::name
    and pg_catalog.pg_has_role(session_user, 'dentpilot_appointment_sync_executor', 'member')
    and r.rolcanlogin and not r.rolsuper and not r.rolbypassrls and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication
  for update of e;
  if v_integration is null then return jsonb_build_object('ok', false, 'code', 'execution_denied'); end if;
  select next_attempt_at into v_next from public.integration_sync_state where integration_id = v_integration;
  if v_next is not null and v_next > clock_timestamp() then return jsonb_build_object('ok', false, 'code', 'retry_not_due'); end if;
  if private.appointment_sync_has_lock(v_integration) or not pg_catalog.pg_try_advisory_lock(20260914, pg_catalog.hashtext(v_integration::text)) then
    return jsonb_build_object('ok', false, 'code', 'sync_busy');
  end if;
  select * into v_checkpoint from private.appointment_sync_checkpoint where integration_id = v_integration;
  if not found then
    perform pg_catalog.pg_advisory_unlock(20260914, pg_catalog.hashtext(v_integration::text));
    return jsonb_build_object('ok', false, 'code', 'persistence_unavailable');
  end if;
  return jsonb_build_object('ok', true, 'checkpoint', jsonb_build_object('integrationId', v_integration, 'initialImportCompleted', v_checkpoint.initial_import_completed, 'confirmedChangeCursor', v_checkpoint.confirmed_change_cursor));
exception when others then
  if v_integration is not null then perform pg_catalog.pg_advisory_unlock(20260914, pg_catalog.hashtext(v_integration::text)); end if;
  return jsonb_build_object('ok', false, 'code', 'persistence_unavailable');
end;
$$;

create function private.commit_appointment_sync(p_expected_cursor text, p_expected_initial boolean, p_snapshot jsonb, p_mutations jsonb, p_candidate_cursor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_integration uuid; v_practice uuid; v_checkpoint private.appointment_sync_checkpoint%rowtype; v_item jsonb;
begin
  select e.integration_id, e.practice_id into v_integration, v_practice
  from private.appointment_sync_executor e join pg_catalog.pg_roles r on r.rolname = session_user
  where e.database_role = session_user::name
    and pg_catalog.pg_has_role(session_user, 'dentpilot_appointment_sync_executor', 'member')
    and r.rolcanlogin and not r.rolsuper and not r.rolbypassrls and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication
  for update of e;
  if v_integration is null or p_expected_initial is null or not private.appointment_sync_has_lock(v_integration) then
    return jsonb_build_object('ok', false, 'code', 'execution_denied');
  end if;
  select * into v_checkpoint from private.appointment_sync_checkpoint where integration_id = v_integration for update;
  if not found or v_checkpoint.initial_import_completed is distinct from p_expected_initial
    or v_checkpoint.confirmed_change_cursor is distinct from p_expected_cursor then
    return jsonb_build_object('ok', false, 'code', 'execution_denied');
  end if;
  if (p_expected_cursor is not null and length(p_expected_cursor) not between 1 and 128)
    or (p_candidate_cursor is not null and length(p_candidate_cursor) not between 1 and 128) then
    return jsonb_build_object('ok', false, 'code', 'source_contract_invalid');
  end if;
  begin
    if jsonb_typeof(p_snapshot) is distinct from 'array' or jsonb_typeof(p_mutations) is distinct from 'array'
      or pg_column_size(p_snapshot) + pg_column_size(p_mutations) > 10485760
      or jsonb_array_length(p_snapshot) + jsonb_array_length(p_mutations) > 10000
      or (p_expected_initial and jsonb_array_length(p_snapshot) > 0) then
      raise exception 'Invalid appointment sync input' using errcode = 'P4001';
    end if;
    for v_item in select value from jsonb_array_elements(p_snapshot) loop
      perform private.apply_appointment_sync_mutation(v_integration, v_practice, jsonb_build_object('operation', 'upsert', 'appointment', v_item));
    end loop;
    for v_item in select value from jsonb_array_elements(p_mutations) loop
      perform private.apply_appointment_sync_mutation(v_integration, v_practice, v_item);
    end loop;
    update private.appointment_sync_checkpoint set initial_import_completed = true,
      confirmed_change_cursor = coalesce(p_candidate_cursor, v_checkpoint.confirmed_change_cursor), updated_at = clock_timestamp()
    where integration_id = v_integration;
    perform private.record_integration_sync_result(v_integration, 'succeeded', null, null);
    return jsonb_build_object('ok', true);
  exception when sqlstate 'P4001' then
    return jsonb_build_object('ok', false, 'code', 'source_contract_invalid');
  when query_canceled then
    return jsonb_build_object('ok', false, 'code', 'persistence_unavailable');
  when others then
    return jsonb_build_object('ok', false, 'code', 'persistence_unavailable');
  end;
end;
$$;

create function private.record_appointment_sync_failure(p_error public.integration_sync_error_code, p_retry_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_integration uuid; v_practice uuid;
begin
  select e.integration_id, e.practice_id into v_integration, v_practice
  from private.appointment_sync_executor e join pg_catalog.pg_roles r on r.rolname = session_user
  where e.database_role = session_user::name
    and pg_catalog.pg_has_role(session_user, 'dentpilot_appointment_sync_executor', 'member')
    and r.rolcanlogin and not r.rolsuper and not r.rolbypassrls and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication
  for update of e;
  if v_integration is null or p_error is null or not private.appointment_sync_has_lock(v_integration) then return false; end if;
  perform private.record_integration_sync_result(v_integration, 'failed', p_error, p_retry_at);
  return true;
exception when others then return false;
end;
$$;

revoke all on function private.initialize_appointment_sync_checkpoint(), private.appointment_sync_identity(), private.appointment_sync_has_lock(uuid), private.apply_appointment_sync_mutation(uuid, uuid, jsonb), private.acquire_appointment_sync(), private.commit_appointment_sync(text, boolean, jsonb, jsonb, text), private.record_appointment_sync_failure(public.integration_sync_error_code, timestamptz)
from public, anon, authenticated, service_role, dentpilot_patient_sync_executor, dentpilot_appointment_sync_executor;
grant execute on function private.acquire_appointment_sync(), private.commit_appointment_sync(text, boolean, jsonb, jsonb, text), private.record_appointment_sync_failure(public.integration_sync_error_code, timestamptz)
to dentpilot_appointment_sync_executor;

alter role dentpilot_appointment_sync_executor set statement_timeout = '5s';
alter role dentpilot_appointment_sync_executor set log_statement = 'none';
alter role dentpilot_appointment_sync_executor set log_parameter_max_length = 0;
