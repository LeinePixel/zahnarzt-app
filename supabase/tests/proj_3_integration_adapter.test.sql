begin;
select plan(25);
select has_table('public', 'integration', 'integration exists');
select has_table('public', 'integration_sync_state', 'state exists');
select has_table('public', 'integration_sync_event', 'event exists');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.integration'::regclass, 'public.integration_sync_state'::regclass, 'public.integration_sync_event'::regclass)), 'all integration tables use RLS');
select ok(not has_table_privilege('authenticated', 'public.integration', 'SELECT,INSERT,UPDATE,DELETE'), 'no browser integration privileges');
select ok(not has_table_privilege('authenticated', 'public.integration_sync_state', 'SELECT,INSERT,UPDATE,DELETE'), 'no browser state privileges');
select ok(not has_table_privilege('authenticated', 'public.integration_sync_event', 'SELECT,INSERT,UPDATE,DELETE'), 'no browser event privileges');
select ok(not has_table_privilege('anon', 'public.integration', 'SELECT,INSERT,UPDATE,DELETE'), 'no anonymous integration privileges');
insert into auth.users(id,email) values
('13000000-0000-0000-0000-000000000001','synthetic-admin@example.invalid'),
('13000000-0000-0000-0000-000000000002','synthetic-reception@example.invalid'),
('13000000-0000-0000-0000-000000000003','synthetic-portal@example.invalid'),
('13000000-0000-0000-0000-000000000004','synthetic-foreign@example.invalid');
insert into public.practice(id,name) values ('23000000-0000-0000-0000-000000000001','Synthetic PROJ-3'),('23000000-0000-0000-0000-000000000002','Synthetic foreign PROJ-3');
insert into public.user_profile(user_id,practice_id,display_name,role) values
('13000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000001','Synthetic admin','praxisadmin'),
('13000000-0000-0000-0000-000000000002','23000000-0000-0000-0000-000000000001','Synthetic reception','rezeption'),
('13000000-0000-0000-0000-000000000004','23000000-0000-0000-0000-000000000002','Synthetic foreign','praxisadmin');
insert into public.portal_admin(user_id) values ('13000000-0000-0000-0000-000000000003');
insert into public.integration(id,practice_id,provider) values ('33000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000001','mock_pvs');
select is((select status::text from public.integration_sync_state where integration_id='33000000-0000-0000-0000-000000000001'), 'idle', 'new integration starts idle');
select throws_ok($$insert into public.integration(practice_id,provider) values ('23000000-0000-0000-0000-000000000001','mock_pvs')$$,'23505',null,'provider is unique per practice');
select ok(not has_function_privilege('authenticated','private.record_integration_sync_result(uuid,text,public.integration_sync_error_code,timestamp with time zone)','EXECUTE'),'browser cannot record');
select ok(not has_function_privilege('authenticated','private.confirm_integration_change_cursor(uuid,text)','EXECUTE'),'browser cannot confirm cursor');
select ok(not has_function_privilege('authenticated','private.purge_expired_integration_sync_events()','EXECUTE'),'browser cannot purge');
select ok(not has_function_privilege('anon','public.read_integration_sync_status()','EXECUTE'),'anonymous cannot call status RPC');
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000001',true);
select is((select count(*) from public.read_integration_sync_status()),1::bigint,'owning admin sees status');
create temporary table proj_3_public_status_shape as select * from public.read_integration_sync_status() limit 0;
select is((select count(*) from pg_attribute where attrelid='pg_temp.proj_3_public_status_shape'::regclass and attnum>0 and not attisdropped),7::bigint,'exactly seven public fields');
select ok(not exists(select 1 from pg_attribute where attrelid='pg_temp.proj_3_public_status_shape'::regclass and attname='confirmed_change_cursor'),'no public cursor');
select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.read_integration_sync_status()),0::bigint,'reception sees nothing');
select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000003',true);
select is((select count(*) from public.read_integration_sync_status()),0::bigint,'portal admin sees nothing');
select set_config('request.jwt.claim.sub','13000000-0000-0000-0000-000000000004',true);
select is((select count(*) from public.read_integration_sync_status()),0::bigint,'foreign admin sees nothing');
reset role;
select lives_ok($$select private.record_integration_sync_result('33000000-0000-0000-0000-000000000001','succeeded',null,null)$$,'technical success is recorded');
select is((select status::text from public.integration_sync_state where integration_id='33000000-0000-0000-0000-000000000001'),'healthy','success makes state healthy');
select is((select confirmed_change_cursor from public.integration_sync_state where integration_id='33000000-0000-0000-0000-000000000001'),null::text,'success never confirms cursor');
set local role service_role;
insert into public.integration_sync_event(integration_id,outcome,attempted_at) values ('33000000-0000-0000-0000-000000000001','succeeded',now()-interval '31 days'),('33000000-0000-0000-0000-000000000001','succeeded',now()-interval '29 days');
reset role;
select is(private.purge_expired_integration_sync_events(),1::bigint,'purge removes only expired events');
select is((select count(*) from public.integration_sync_event where integration_id='33000000-0000-0000-0000-000000000001'),2::bigint,'recent events remain');
select * from finish();
rollback;
