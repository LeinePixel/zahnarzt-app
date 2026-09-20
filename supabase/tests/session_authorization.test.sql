begin;

select plan(22);

select has_table(
  'private',
  'session_security_state',
  'session security state is kept behind the private schema boundary'
);
select has_function(
  'private',
  'has_valid_aal2_session',
  array[]::text[],
  'one private function decides the current database session boundary'
);
select has_function(
  'public',
  'initialize_current_session',
  array[]::text[],
  'an AAL2 bootstrap RPC initializes only the current auth session'
);
select ok(
  not has_table_privilege('authenticated', 'private.session_security_state', 'SELECT')
    and not has_table_privilege('authenticated', 'private.session_security_state', 'INSERT')
    and not has_table_privilege('authenticated', 'private.session_security_state', 'UPDATE')
    and not has_table_privilege('authenticated', 'private.session_security_state', 'DELETE'),
  'authenticated callers have no direct access to private session state'
);
select ok(
  has_function_privilege('authenticated', 'public.initialize_current_session()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.initialize_current_session()', 'EXECUTE'),
  'only authenticated identities can call the session bootstrap RPC'
);

insert into auth.users (id, email)
values
  ('31000000-0000-0000-0000-000000000001', 'session-one@example.invalid'),
  ('31000000-0000-0000-0000-000000000002', 'session-two@example.invalid'),
  ('31000000-0000-0000-0000-000000000003', 'session-portal@example.invalid');

insert into public.practice (id, name)
values
  ('32000000-0000-0000-0000-000000000001', 'Session Testpraxis Eins'),
  ('32000000-0000-0000-0000-000000000002', 'Session Testpraxis Zwei');

insert into public.user_profile (user_id, practice_id, display_name, role)
values
  (
    '31000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    'Session Testperson Eins',
    'praxisadmin'
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '32000000-0000-0000-0000-000000000002',
    'Session Testperson Zwei',
    'behandler'
  );

insert into public.portal_admin (user_id)
values ('31000000-0000-0000-0000-000000000003');

insert into public.integration (id, practice_id, provider)
values (
  '34000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  'mock_pvs'
);

insert into auth.sessions (id, user_id, created_at, updated_at, aal, not_after)
values
  (
    '33000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001',
    now() - interval '7 hours',
    now(),
    'aal2',
    now() + interval '1 hour'
  ),
  (
    '33000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000002',
    now() - interval '1 minute',
    now(),
    'aal1',
    now() + interval '7 hours 59 minutes'
  ),
  (
    '33000000-0000-0000-0000-000000000003',
    '31000000-0000-0000-0000-000000000003',
    now() - interval '1 minute',
    now(),
    'aal2',
    now() + interval '7 hours 59 minutes'
  );

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '31000000-0000-0000-0000-000000000002',
    'role', 'authenticated',
    'aal', 'aal1',
    'session_id', '33000000-0000-0000-0000-000000000002'
  )::text,
  true
);
set local role authenticated;

select is(
  (select count(*) from public.practice),
  0::bigint,
  'AAL1 cannot read practice data despite a valid role and profile'
);
select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'AAL1 cannot read its own user profile'
);
select is(
  public.request_support_access(8),
  null::uuid,
  'AAL1 cannot execute a protected support RPC'
);
select is(
  (select count(*) from public.read_integration_sync_status()),
  0::bigint,
  'AAL1 cannot execute the protected integration-status RPC'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '31000000-0000-0000-0000-000000000001',
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', '33999999-9999-9999-9999-999999999999'
  )::text,
  true
);
set local role authenticated;

select is(
  public.initialize_current_session(),
  false,
  'a JWT without a matching auth session cannot initialize state'
);
select is(
  (select count(*) from public.practice),
  0::bigint,
  'a missing auth session cannot read protected data'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '31000000-0000-0000-0000-000000000001',
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', '33000000-0000-0000-0000-000000000001'
  )::text,
  true
);
set local role authenticated;

select is(
  public.initialize_current_session(),
  true,
  'a current AAL2 auth session initializes private state'
);
select is(
  (select count(*) from public.practice),
  1::bigint,
  'an active AAL2 session reads exactly its own practice'
);
select is(
  (
    select count(*)
    from public.practice
    where id = '32000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'AAL2 preserves the existing tenant boundary'
);
select is(
  (select count(*) from public.read_integration_sync_status()),
  1::bigint,
  'an active praxisadmin AAL2 session reads its integration status'
);

reset role;
update private.session_security_state
set revoked_at = now()
where session_id = '33000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*) from public.practice),
  0::bigint,
  'a revoked session is denied on the next protected query'
);

reset role;
update private.session_security_state
set revoked_at = null
where session_id = '33000000-0000-0000-0000-000000000001';
update auth.users
set banned_until = now() + interval '1 hour'
where id = '31000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*) from public.practice),
  0::bigint,
  'a newly blocked account is denied on the next protected query'
);

reset role;
update auth.users
set banned_until = null
where id = '31000000-0000-0000-0000-000000000001';
update private.session_security_state
set
    last_human_activity_at = now() - interval '5 minutes'
where session_id = '33000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*) from public.practice),
  0::bigint,
  'the inactivity timeout denies exactly at five minutes'
);

reset role;
update private.session_security_state
set last_human_activity_at = now() - interval '4 minutes 59 seconds',
    started_at = now() - interval '7 hours 59 minutes 59 seconds'
where session_id = '33000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*) from public.practice),
  1::bigint,
  'the session remains valid immediately before both timeout boundaries'
);

reset role;
update private.session_security_state
set started_at = now() - interval '8 hours'
where session_id = '33000000-0000-0000-0000-000000000001';
set local role authenticated;

select is(
  (select count(*) from public.practice),
  0::bigint,
  'the absolute session timeout denies exactly at eight hours'
);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '31000000-0000-0000-0000-000000000003',
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', '33000000-0000-0000-0000-000000000003'
  )::text,
  true
);
set local role authenticated;

select is(
  public.initialize_current_session(),
  true,
  'a portal-admin AAL2 session initializes through the same boundary'
);
select is(
  public.is_portal_admin(),
  true,
  'an active portal-admin AAL2 session passes the protected identity RPC'
);

reset role;
select * from finish();
rollback;
