begin;
select plan(22);

select has_table('public', 'appointment', 'appointment projection exists');
select has_table('private', 'appointment_source_version', 'delete versions are private');
select has_table('private', 'appointment_sync_checkpoint', 'appointment cursor is private');
select has_table('private', 'appointment_sync_executor', 'login mapping is private');
select has_column('public', 'appointment', 'patient_id', 'appointment resolves to an internal patient');
select col_type_is('public', 'appointment', 'status', 'public.appointment_status', 'appointment has an approved status');
select ok(exists(
  select 1 from pg_constraint
  where conrelid = 'public.appointment'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%ends_at > starts_at%'
), 'appointment end follows start');
select has_index('public', 'appointment', 'appointment_integration_source_unique', 'one external appointment exists per integration');
select has_index('public', 'appointment', 'appointment_patient_starts_at', 'patient appointment ranges are indexed');
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.appointment'::regclass,
  'private.appointment_source_version'::regclass,
  'private.appointment_sync_checkpoint'::regclass,
  'private.appointment_sync_executor'::regclass
)), 'all appointment sync tables use RLS');
select ok(not has_table_privilege('authenticated', 'public.appointment', 'SELECT,INSERT,UPDATE,DELETE'), 'browser has no appointment access');
select ok(not has_table_privilege('dentpilot_appointment_sync_executor', 'public.appointment', 'SELECT,INSERT,UPDATE,DELETE'), 'runtime has no direct appointment access');
select ok(not has_function_privilege('authenticated', 'private.commit_appointment_sync(text,boolean,jsonb,jsonb,text)', 'EXECUTE'), 'browser cannot commit appointments');
select ok(has_function_privilege('dentpilot_appointment_sync_executor', 'private.acquire_appointment_sync()', 'EXECUTE'), 'appointment runtime can acquire');
select ok(has_function_privilege('dentpilot_appointment_sync_executor', 'private.commit_appointment_sync(text,boolean,jsonb,jsonb,text)', 'EXECUTE'), 'appointment runtime can commit');
select ok(has_function_privilege('dentpilot_appointment_sync_executor', 'private.record_appointment_sync_failure(public.integration_sync_error_code,timestamp with time zone)', 'EXECUTE'), 'appointment runtime can record failure');
select ok(not has_function_privilege('dentpilot_appointment_sync_executor', 'private.appointment_sync_identity()', 'EXECUTE'), 'appointment runtime cannot call identity helper');
select ok(not has_function_privilege('dentpilot_appointment_sync_executor', 'private.apply_appointment_sync_mutation(uuid,uuid,jsonb)', 'EXECUTE'), 'appointment runtime cannot call mutation helper');
select ok(not (select rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication from pg_roles where rolname = 'dentpilot_appointment_sync_executor'), 'appointment group has safe attributes');
select is((select proconfig from pg_proc where oid = 'private.acquire_appointment_sync()'::regprocedure), array['search_path=""'], 'acquire has empty search path');
select is((select proconfig from pg_proc where oid = 'private.commit_appointment_sync(text,boolean,jsonb,jsonb,text)'::regprocedure), array['search_path=""'], 'commit has empty search path');
select is((select proconfig from pg_proc where oid = 'private.record_appointment_sync_failure(public.integration_sync_error_code,timestamp with time zone)'::regprocedure), array['search_path=""'], 'failure writer has empty search path');

select * from finish();
rollback;
