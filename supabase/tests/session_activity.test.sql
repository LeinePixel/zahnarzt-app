begin;
select plan(6);

select has_function('public', 'record_current_session_activity', array[]::text[], 'activity RPC exists');
select ok(has_function_privilege('authenticated', 'public.record_current_session_activity()', 'EXECUTE'), 'authenticated can record current activity');
select ok(not has_function_privilege('anon', 'public.record_current_session_activity()', 'EXECUTE'), 'anonymous cannot call activity RPC');

insert into auth.users(id,email) values ('35000000-0000-0000-0000-000000000001','activity@example.invalid');
insert into auth.sessions(id,user_id,created_at,updated_at,aal,not_after) values ('36000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001',now()-interval '1 hour',now(),'aal2',now()+interval '7 hours');
insert into private.session_security_state(session_id,user_id,started_at,last_human_activity_at) values ('36000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001',now()-interval '1 hour',now()-interval '1 minute');
select set_config('request.jwt.claims',json_build_object('sub','35000000-0000-0000-0000-000000000001','role','authenticated','aal','aal2','session_id','36000000-0000-0000-0000-000000000001')::text,true);
set local role authenticated;
select is(public.record_current_session_activity(),true,'active AAL2 session records activity');

reset role;
update private.session_security_state set last_human_activity_at=now()-interval '5 minutes' where session_id='36000000-0000-0000-0000-000000000001';
set local role authenticated;
select is(public.record_current_session_activity(),false,'expired inactivity cannot revive itself');

reset role;
update private.session_security_state set last_human_activity_at=now(),revoked_at=now() where session_id='36000000-0000-0000-0000-000000000001';
set local role authenticated;
select is(public.record_current_session_activity(),false,'revoked session cannot record activity');

reset role;
select * from finish();
rollback;
