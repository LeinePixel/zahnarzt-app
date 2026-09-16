begin;
select plan(18);

select has_table('public','patient','patient projection exists');
select has_table('private','patient_source_version','delete versions are private');
select has_table('private','patient_sync_checkpoint','patient cursor is private');
select has_table('private','patient_sync_executor','login mapping is private');
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.patient'::regclass,
  'private.patient_source_version'::regclass,
  'private.patient_sync_checkpoint'::regclass,
  'private.patient_sync_executor'::regclass
)), 'all patient sync tables use RLS');
select ok(not has_table_privilege('authenticated','public.patient','SELECT,INSERT,UPDATE,DELETE'),'browser has no patient table access');
select ok(not has_table_privilege('anon','public.patient','SELECT,INSERT,UPDATE,DELETE'),'anonymous has no patient table access');
select ok(not has_table_privilege('dentpilot_patient_sync_executor','public.patient','SELECT,INSERT,UPDATE,DELETE'),'runtime has no direct patient table access');
select ok(not has_function_privilege('authenticated','private.commit_patient_sync(text,boolean,jsonb,jsonb,text)','EXECUTE'),'browser cannot commit');
select ok(has_function_privilege('dentpilot_patient_sync_executor','private.acquire_patient_sync()','EXECUTE'),'runtime can acquire');
select ok(has_function_privilege('dentpilot_patient_sync_executor','private.commit_patient_sync(text,boolean,jsonb,jsonb,text)','EXECUTE'),'runtime can commit');
select ok(has_function_privilege('dentpilot_patient_sync_executor','private.record_patient_sync_failure(public.integration_sync_error_code,timestamp with time zone)','EXECUTE'),'runtime can record failure');
select ok(not has_function_privilege('dentpilot_patient_sync_executor','private.patient_sync_identity()','EXECUTE'),'runtime cannot call identity helper');
select ok(not has_function_privilege('dentpilot_patient_sync_executor','private.apply_patient_sync_mutation(uuid,uuid,jsonb)','EXECUTE'),'runtime cannot call mutation helper');
select ok(not (select rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication from pg_roles where rolname='dentpilot_patient_sync_executor'),'runtime group has safe attributes');
select is((select proconfig from pg_proc where oid='private.acquire_patient_sync()'::regprocedure),array['search_path=""'],'acquire has empty search path');
select is((select proconfig from pg_proc where oid='private.commit_patient_sync(text,boolean,jsonb,jsonb,text)'::regprocedure),array['search_path=""'],'commit has empty search path');
select is((select proconfig from pg_proc where oid='private.record_patient_sync_failure(public.integration_sync_error_code,timestamp with time zone)'::regprocedure),array['search_path=""'],'failure writer has empty search path');

select * from finish();
rollback;
