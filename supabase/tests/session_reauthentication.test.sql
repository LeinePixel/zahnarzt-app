begin;
select plan(7);

select has_function('private', 'has_recent_reauthentication', array[]::text[], 'recent reauthentication check exists');
select ok(not has_function_privilege('authenticated', 'private.has_recent_reauthentication()', 'EXECUTE'), 'clients cannot call the private reauthentication check');

insert into auth.users(id,email) values
  ('37000000-0000-0000-0000-000000000001','reauth-admin@example.invalid'),
  ('37000000-0000-0000-0000-000000000002','reauth-portal@example.invalid');
insert into public.practice(id,name) values ('38000000-0000-0000-0000-000000000001','Reauth Testpraxis');
insert into public.user_profile(user_id,practice_id,display_name,role) values
  ('37000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','Reauth Admin','praxisadmin');
insert into public.portal_admin(user_id) values ('37000000-0000-0000-0000-000000000002');
insert into auth.sessions(id,user_id,created_at,updated_at,aal,not_after) values
  ('39000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000002',now()-interval '1 hour',now(),'aal2',now()+interval '7 hours');
insert into private.session_security_state(session_id,user_id,started_at,last_human_activity_at) values
  ('39000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000002',now()-interval '1 hour',now());
insert into public.support_access_grant(id,practice_id,requested_by,requested_at,requested_duration_hours,activation_deadline) values
  ('3a000000-0000-0000-0000-000000000001','38000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001',now(),8,now()+interval '24 hours');

select set_config('request.jwt.claims',json_build_object(
  'sub','37000000-0000-0000-0000-000000000002','role','authenticated','aal','aal2',
  'session_id','39000000-0000-0000-0000-000000000001',
  'amr',json_build_array(json_build_object('method','totp','timestamp',extract(epoch from now()-interval '5 minutes 1 second')::bigint))
)::text,true);
set local role authenticated;
select is(public.activate_support_access('3a000000-0000-0000-0000-000000000001','technical_investigation'),null::jsonb,'reauthentication older than five minutes is expired');

reset role;
select set_config('request.jwt.claims',json_build_object(
  'sub','37000000-0000-0000-0000-000000000002','role','authenticated','aal','aal2',
  'session_id','39000000-0000-0000-0000-000000000001',
  'amr',json_build_array(json_build_object('method','password','timestamp',extract(epoch from now())::bigint))
)::text,true);
set local role authenticated;
select is(public.activate_support_access('3a000000-0000-0000-0000-000000000001','technical_investigation'),null::jsonb,'a recent password method does not satisfy TOTP reauthentication');

reset role;
select set_config('request.jwt.claims',json_build_object(
  'sub','37000000-0000-0000-0000-000000000002','role','authenticated','aal','aal2',
  'session_id','39000000-0000-0000-0000-000000000001',
  'amr',json_build_array(json_build_object('method','totp','timestamp',extract(epoch from now()-interval '4 minutes 59 seconds')::bigint))
)::text,true);
set local role authenticated;
select isnt(public.activate_support_access('3a000000-0000-0000-0000-000000000001','technical_investigation'),null::jsonb,'recent TOTP reauthentication permits support activation');
select isnt((select count(*) from public.read_audit_events('38000000-0000-0000-0000-000000000001',now(),100)),0::bigint,'recent TOTP reauthentication permits audit reading');

reset role;
select set_config('request.jwt.claims',json_build_object(
  'sub','37000000-0000-0000-0000-000000000002','role','authenticated','aal','aal2',
  'session_id','39000000-0000-0000-0000-000000000001',
  'amr',json_build_array(json_build_object('method','totp','timestamp',extract(epoch from now()-interval '5 minutes 1 second')::bigint))
)::text,true);
set local role authenticated;
select is((select count(*) from public.read_audit_events('38000000-0000-0000-0000-000000000001',now(),100)),0::bigint,'expired reauthentication denies audit reading despite an active grant');

reset role;
select * from finish();
rollback;
