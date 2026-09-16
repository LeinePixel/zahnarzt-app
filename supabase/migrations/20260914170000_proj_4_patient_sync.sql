alter table public.integration
  add constraint integration_id_practice_unique unique(id, practice_id);

do $$
begin
  if not exists(select 1 from pg_catalog.pg_roles where rolname = 'dentpilot_patient_sync_executor') then
    create role dentpilot_patient_sync_executor nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
  elsif exists(
    select 1 from pg_catalog.pg_roles
    where rolname = 'dentpilot_patient_sync_executor'
      and (rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)
  ) then
    raise exception 'Invalid patient sync group configuration';
  end if;
end;
$$;

create table public.patient (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practice(id) on delete cascade,
  integration_id uuid not null,
  source_id text not null check(length(source_id) between 1 and 100),
  source_version integer not null check(source_version > 0),
  first_name text not null check(length(first_name) between 1 and 200),
  last_name text not null check(length(last_name) between 1 and 200),
  birth_date date not null,
  phone_e164 text not null check(phone_e164 ~ '^\+[1-9][0-9]{1,14}$'),
  source_created_at timestamptz not null,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(integration_id, practice_id) references public.integration(id, practice_id) on delete cascade,
  unique(integration_id, source_id)
);
create index patient_practice on public.patient(practice_id);
create index patient_integration on public.patient(integration_id);
create index patient_practice_phone on public.patient(practice_id, phone_e164);

create table private.patient_source_version (
  integration_id uuid not null,
  practice_id uuid not null,
  source_id text not null check(length(source_id) between 1 and 100),
  source_version integer not null check(source_version > 0),
  is_deleted boolean not null,
  updated_at timestamptz not null default now(),
  primary key(integration_id, source_id),
  foreign key(integration_id, practice_id) references public.integration(id, practice_id) on delete cascade
);

create table private.patient_sync_checkpoint (
  integration_id uuid primary key,
  practice_id uuid not null,
  initial_import_completed boolean not null default false,
  confirmed_change_cursor text check(length(confirmed_change_cursor) between 1 and 128),
  updated_at timestamptz not null default now(),
  foreign key(integration_id, practice_id) references public.integration(id, practice_id) on delete cascade
);

create table private.patient_sync_executor (
  database_role name primary key,
  integration_id uuid not null,
  practice_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key(integration_id, practice_id) references public.integration(id, practice_id) on delete cascade
);

alter table public.patient enable row level security;
alter table private.patient_source_version enable row level security;
alter table private.patient_sync_checkpoint enable row level security;
alter table private.patient_sync_executor enable row level security;

revoke all on public.patient from public, anon, authenticated, dentpilot_patient_sync_executor;
revoke all on private.patient_source_version, private.patient_sync_checkpoint, private.patient_sync_executor
  from public, anon, authenticated, dentpilot_patient_sync_executor;
grant all on public.patient to service_role;
grant all on private.patient_source_version, private.patient_sync_checkpoint, private.patient_sync_executor to service_role;
grant usage on schema private to dentpilot_patient_sync_executor;

create function private.initialize_patient_sync_checkpoint() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.patient_sync_checkpoint(integration_id, practice_id)
  values(new.id, new.practice_id) on conflict(integration_id) do nothing;
  return new;
end;
$$;
revoke all on function private.initialize_patient_sync_checkpoint() from public, anon, authenticated, service_role, dentpilot_patient_sync_executor;
create trigger initialize_patient_sync_checkpoint after insert on public.integration
for each row execute function private.initialize_patient_sync_checkpoint();
insert into private.patient_sync_checkpoint(integration_id, practice_id)
select id, practice_id from public.integration on conflict(integration_id) do nothing;

create function private.patient_sync_identity()
returns table(integration_id uuid, practice_id uuid)
language sql security definer set search_path = '' stable as $$
  select e.integration_id, e.practice_id
  from private.patient_sync_executor e
  join pg_catalog.pg_roles r on r.rolname = session_user
  where e.database_role = session_user::name
    and pg_catalog.pg_has_role(session_user, 'dentpilot_patient_sync_executor', 'member')
    and r.rolcanlogin and not r.rolsuper and not r.rolbypassrls
    and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication
$$;

create function private.patient_sync_has_lock(p_integration_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists(
    select 1 from pg_catalog.pg_locks
    where locktype = 'advisory' and pid = pg_catalog.pg_backend_pid()
      and classid = 20260914::oid
      and objid = (pg_catalog.hashtext(p_integration_id::text)::bit(32)::bigint)::oid
      and objsubid = 2 and granted
  )
$$;

create function private.apply_patient_sync_mutation(p_integration_id uuid, p_practice_id uuid, p_mutation jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_operation text; v_source_id text; v_version integer; v_patient jsonb;
  v_stored private.patient_source_version%rowtype; v_existing public.patient%rowtype;
begin
  if jsonb_typeof(p_mutation) <> 'object' then raise exception 'Invalid mutation' using errcode = 'P4001'; end if;
  v_operation := p_mutation->>'operation';
  if v_operation = 'upsert' then
    if (select array_agg(key order by key) from jsonb_object_keys(p_mutation) key) <> array['operation','patient'] then raise exception 'Invalid mutation' using errcode='P4001'; end if;
    v_patient := p_mutation->'patient';
    if jsonb_typeof(v_patient) <> 'object'
      or (select array_agg(key order by key) from jsonb_object_keys(v_patient) key) <> array['birthDate','firstName','lastName','phoneE164','sourceCreatedAt','sourceId','sourceUpdatedAt','sourceVersion']
    then raise exception 'Invalid mutation' using errcode='P4001'; end if;
    v_source_id := v_patient->>'sourceId';
    if jsonb_typeof(v_patient->'sourceVersion') <> 'number' then raise exception 'Invalid mutation' using errcode='P4001'; end if;
    v_version := (v_patient->>'sourceVersion')::integer;
    if v_source_id is null or length(v_source_id) not between 1 and 100 or v_version < 1
      or length(v_patient->>'firstName') not between 1 and 200 or length(v_patient->>'lastName') not between 1 and 200
      or not (v_patient->>'phoneE164' ~ '^\+[1-9][0-9]{1,14}$')
    then raise exception 'Invalid mutation' using errcode='P4001'; end if;
    perform (v_patient->>'birthDate')::date, (v_patient->>'sourceCreatedAt')::timestamptz, (v_patient->>'sourceUpdatedAt')::timestamptz;
  elsif v_operation = 'delete' then
    if (select array_agg(key order by key) from jsonb_object_keys(p_mutation) key) <> array['operation','sourceId','sourceVersion']
      or jsonb_typeof(p_mutation->'sourceVersion') <> 'number'
    then raise exception 'Invalid mutation' using errcode='P4001'; end if;
    v_source_id := p_mutation->>'sourceId'; v_version := (p_mutation->>'sourceVersion')::integer;
    if v_source_id is null or length(v_source_id) not between 1 and 100 or v_version < 1 then raise exception 'Invalid mutation' using errcode='P4001'; end if;
  else raise exception 'Invalid mutation' using errcode='P4001';
  end if;

  select * into v_stored from private.patient_source_version
  where integration_id=p_integration_id and source_id=v_source_id for update;
  if found and v_version < v_stored.source_version then return; end if;
  if found and v_version = v_stored.source_version then
    if v_operation='delete' and v_stored.is_deleted then return; end if;
    if v_operation='upsert' and not v_stored.is_deleted then
      select * into v_existing from public.patient where integration_id=p_integration_id and source_id=v_source_id;
      if found and (v_existing.source_version,v_existing.first_name,v_existing.last_name,v_existing.birth_date,v_existing.phone_e164,v_existing.source_created_at,v_existing.source_updated_at)
        is not distinct from (v_version,v_patient->>'firstName',v_patient->>'lastName',(v_patient->>'birthDate')::date,v_patient->>'phoneE164',(v_patient->>'sourceCreatedAt')::timestamptz,(v_patient->>'sourceUpdatedAt')::timestamptz)
      then return; end if;
    end if;
    raise exception 'Conflicting source version' using errcode='P4001';
  end if;

  if v_operation='delete' then
    delete from public.patient where integration_id=p_integration_id and source_id=v_source_id;
  else
    insert into public.patient(practice_id,integration_id,source_id,source_version,first_name,last_name,birth_date,phone_e164,source_created_at,source_updated_at)
    values(p_practice_id,p_integration_id,v_source_id,v_version,v_patient->>'firstName',v_patient->>'lastName',(v_patient->>'birthDate')::date,v_patient->>'phoneE164',(v_patient->>'sourceCreatedAt')::timestamptz,(v_patient->>'sourceUpdatedAt')::timestamptz)
    on conflict(integration_id,source_id) do update set source_version=excluded.source_version,first_name=excluded.first_name,last_name=excluded.last_name,birth_date=excluded.birth_date,phone_e164=excluded.phone_e164,source_created_at=excluded.source_created_at,source_updated_at=excluded.source_updated_at,updated_at=clock_timestamp();
  end if;
  insert into private.patient_source_version(integration_id,practice_id,source_id,source_version,is_deleted,updated_at)
  values(p_integration_id,p_practice_id,v_source_id,v_version,v_operation='delete',clock_timestamp())
  on conflict(integration_id,source_id) do update set source_version=excluded.source_version,is_deleted=excluded.is_deleted,updated_at=excluded.updated_at;
exception when sqlstate '22007' or sqlstate '22P02' or sqlstate '22003' then
  raise exception 'Invalid mutation' using errcode='P4001';
end;
$$;

create function private.acquire_patient_sync() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_integration uuid; v_practice uuid; v_checkpoint private.patient_sync_checkpoint%rowtype; v_next timestamptz;
begin
  select integration_id,practice_id into v_integration,v_practice from private.patient_sync_identity();
  if v_integration is null then return jsonb_build_object('ok',false,'code','execution_denied'); end if;
  select next_attempt_at into v_next from public.integration_sync_state where integration_id=v_integration;
  if v_next is not null and v_next>clock_timestamp() then return jsonb_build_object('ok',false,'code','retry_not_due'); end if;
  if private.patient_sync_has_lock(v_integration) or not pg_catalog.pg_try_advisory_lock(20260914,pg_catalog.hashtext(v_integration::text)) then
    return jsonb_build_object('ok',false,'code','sync_busy');
  end if;
  select * into v_checkpoint from private.patient_sync_checkpoint where integration_id=v_integration;
  if not found then perform pg_catalog.pg_advisory_unlock(20260914,pg_catalog.hashtext(v_integration::text)); return jsonb_build_object('ok',false,'code','persistence_unavailable'); end if;
  return jsonb_build_object('ok',true,'checkpoint',jsonb_build_object('integrationId',v_integration,'initialImportCompleted',v_checkpoint.initial_import_completed,'confirmedChangeCursor',v_checkpoint.confirmed_change_cursor));
exception when others then
  if v_integration is not null then perform pg_catalog.pg_advisory_unlock(20260914,pg_catalog.hashtext(v_integration::text)); end if;
  return jsonb_build_object('ok',false,'code','persistence_unavailable');
end;
$$;

create function private.commit_patient_sync(p_expected_cursor text,p_expected_initial boolean,p_snapshot jsonb,p_mutations jsonb,p_candidate_cursor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_integration uuid; v_practice uuid; v_checkpoint private.patient_sync_checkpoint%rowtype; v_item jsonb;
begin
  select integration_id,practice_id into v_integration,v_practice from private.patient_sync_identity();
  if v_integration is null or p_expected_initial is null or not private.patient_sync_has_lock(v_integration) then return jsonb_build_object('ok',false,'code','execution_denied'); end if;
  select * into v_checkpoint from private.patient_sync_checkpoint where integration_id=v_integration for update;
  if not found or v_checkpoint.initial_import_completed is distinct from p_expected_initial or v_checkpoint.confirmed_change_cursor is distinct from p_expected_cursor then return jsonb_build_object('ok',false,'code','execution_denied'); end if;
  if (p_expected_cursor is not null and length(p_expected_cursor) not between 1 and 128) or (p_candidate_cursor is not null and length(p_candidate_cursor) not between 1 and 128) then return jsonb_build_object('ok',false,'code','source_contract_invalid'); end if;
  begin
    if jsonb_typeof(p_snapshot)<>'array' or jsonb_typeof(p_mutations)<>'array' or pg_column_size(p_snapshot)+pg_column_size(p_mutations)>10485760 or jsonb_array_length(p_snapshot)+jsonb_array_length(p_mutations)>10000 or (p_expected_initial and jsonb_array_length(p_snapshot)>0) then raise exception 'Invalid batch' using errcode='P4001'; end if;
    for v_item in select value from jsonb_array_elements(p_snapshot) loop
      perform private.apply_patient_sync_mutation(v_integration,v_practice,jsonb_build_object('operation','upsert','patient',v_item));
    end loop;
    for v_item in select value from jsonb_array_elements(p_mutations) loop
      perform private.apply_patient_sync_mutation(v_integration,v_practice,v_item);
    end loop;
    update private.patient_sync_checkpoint set initial_import_completed=true,confirmed_change_cursor=p_candidate_cursor,updated_at=clock_timestamp() where integration_id=v_integration;
    perform private.record_integration_sync_result(v_integration,'succeeded',null,null);
    return jsonb_build_object('ok',true);
  exception when sqlstate 'P4001' then return jsonb_build_object('ok',false,'code','source_contract_invalid');
    when query_canceled then return jsonb_build_object('ok',false,'code','persistence_unavailable');
    when others then return jsonb_build_object('ok',false,'code','persistence_unavailable');
  end;
end;
$$;

create function private.record_patient_sync_failure(p_error public.integration_sync_error_code,p_retry_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_integration uuid; v_practice uuid;
begin
  select integration_id,practice_id into v_integration,v_practice from private.patient_sync_identity();
  if v_integration is null or not private.patient_sync_has_lock(v_integration) then return false; end if;
  perform private.record_integration_sync_result(v_integration,'failed',p_error,p_retry_at);
  return true;
exception when others then return false;
end;
$$;

revoke all on function private.patient_sync_identity(),private.patient_sync_has_lock(uuid),private.apply_patient_sync_mutation(uuid,uuid,jsonb),private.acquire_patient_sync(),private.commit_patient_sync(text,boolean,jsonb,jsonb,text),private.record_patient_sync_failure(public.integration_sync_error_code,timestamptz)
from public,anon,authenticated,service_role,dentpilot_patient_sync_executor;
grant execute on function private.acquire_patient_sync(),private.commit_patient_sync(text,boolean,jsonb,jsonb,text),private.record_patient_sync_failure(public.integration_sync_error_code,timestamptz)
to dentpilot_patient_sync_executor;
