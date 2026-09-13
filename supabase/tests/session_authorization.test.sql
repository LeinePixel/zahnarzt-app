begin;

select plan(44);

insert into auth.users (id, email)
values
  ('41000000-0000-0000-0000-000000000001', 'session-praxisadmin@example.invalid'),
  ('41000000-0000-0000-0000-000000000002', 'session-foreign@example.invalid'),
  ('41000000-0000-0000-0000-000000000003', 'session-portaladmin@example.invalid'),
  ('41000000-0000-0000-0000-000000000004', 'session-banned@example.invalid');

insert into public.practice (id, name)
values
  ('42000000-0000-0000-0000-000000000001', 'Sitzungstestpraxis Eins'),
  ('42000000-0000-0000-0000-000000000002', 'Sitzungstestpraxis Zwei');

insert into public.user_profile (user_id, practice_id, display_name, role)
values
  (
    '41000000-0000-0000-0000-000000000001',
    '42000000-0000-0000-0000-000000000001',
    'Sitzung Praxisadmin',
    'praxisadmin'
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '42000000-0000-0000-0000-000000000002',
    'Sitzung Fremde Praxis',
    'behandler'
  ),
  (
    '41000000-0000-0000-0000-000000000004',
    '42000000-0000-0000-0000-000000000001',
    'Sitzung Gesperrt',
    'rezeption'
  );

insert into public.portal_admin (user_id)
values ('41000000-0000-0000-0000-000000000003');

insert into auth.sessions (id, user_id, aal, not_after)
values
  (
    '43000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    'aal2',
    now() + interval '8 hours'
  ),
  (
    '43000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000003',
    'aal2',
    now() + interval '8 hours'
  ),
  (
    '43000000-0000-0000-0000-000000000003',
    '41000000-0000-0000-0000-000000000004',
    'aal2',
    now() + interval '8 hours'
  ),
  (
    '43000000-0000-0000-0000-000000000004',
    '41000000-0000-0000-0000-000000000001',
    'aal2',
    now() - interval '1 second'
  );

insert into public.support_access_grant (
  id,
  practice_id,
  requested_by,
  requested_duration_hours,
  activation_deadline,
  activated_by,
  activated_at,
  expires_at,
  support_reason
)
values
  (
    '44000000-0000-0000-0000-000000000001',
    '42000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    8,
    now() + interval '24 hours',
    '41000000-0000-0000-0000-000000000003',
    now() - interval '1 minute',
    now() - interval '1 minute' + interval '8 hours',
    'account_support'
  ),
  (
    '44000000-0000-0000-0000-000000000002',
    '42000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    8,
    now() + interval '24 hours',
    null,
    null,
    null,
    null
  );

insert into public.audit_event (
  id,
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
  '45000000-0000-0000-0000-000000000001',
  '42000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001',
  'practice_member',
  'support_access_requested',
  'allowed',
  'support_access_grant',
  '44000000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000001'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000001"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'an AAL2 session without state cannot read its own protected profile'
);
select is(
  (select count(*) from public.practice),
  0::bigint,
  'an AAL2 session without state cannot read its own protected practice'
);
select is(
  public.session_gate(),
  'reauth_required',
  'an AAL2 session without server state is globally locked'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '41000000-0000-0000-0000-000000000001',
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', '43000000-0000-0000-0000-000000000001',
    'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::integer))
  )::text,
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.establish_session_state(),
  true,
  'a fresh TOTP AAL2 session establishes server-timestamped state'
);
select is(
  public.session_gate(),
  'ready',
  'established state releases the safe SSR gate'
);
select is(
  public.touch_session_state(),
  true,
  'human activity can touch a current server state without client time'
);
select is(
  (select count(*) from public.user_profile),
  1::bigint,
  'an established AAL2 session can read its own protected profile'
);
select is(
  (select count(*) from public.practice),
  1::bigint,
  'an established AAL2 session can read its own protected practice'
);

reset role;
update private.auth_session_state
set established_at = now() - interval '5 minutes 1 second',
    last_human_activity_at = now() - interval '5 minutes 1 second'
where session_id = '43000000-0000-0000-0000-000000000001';
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000001"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.touch_session_state(),
  false,
  'an expired inactivity state cannot be renewed by a background touch'
);
select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'RLS denies after five minutes without human activity'
);
select is(
  public.request_support_access(8),
  null::uuid,
  'sensitive support RPCs deny after inactivity expires'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '41000000-0000-0000-0000-000000000001',
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', '43000000-0000-0000-0000-000000000001',
    'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::integer))
  )::text,
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.establish_session_state(),
  true,
  'a new TOTP confirmation restores the server state'
);

reset role;
update private.auth_session_state
set established_at = now() - interval '7 hours 59 minutes',
    last_human_activity_at = now() - interval '1 minute',
    fresh_totp_at = now() - interval '1 minute'
where session_id = '43000000-0000-0000-0000-000000000001';
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '41000000-0000-0000-0000-000000000001',
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', '43000000-0000-0000-0000-000000000001',
    'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::integer))
  )::text,
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.establish_session_state(),
  true,
  'a fresh reauthentication can restore activity before the absolute session limit'
);

reset role;
select ok(
  (
    select established_at < now() - interval '7 hours 58 minutes'
    from private.auth_session_state
    where session_id = '43000000-0000-0000-0000-000000000001'
  ),
  'fresh reauthentication does not extend the eight-hour absolute session start'
);

update private.auth_session_state
set established_at = now() - interval '6 minutes',
    fresh_totp_at = now() - interval '5 minutes 1 second',
    last_human_activity_at = now()
where session_id = '43000000-0000-0000-0000-000000000001';
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000001"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.request_support_access(8),
  null::uuid,
  'a stale TOTP confirmation denies a sensitive support operation'
);

reset role;
select is(
  (
    select count(*)
    from public.audit_event
    where actor_id = '41000000-0000-0000-0000-000000000001'
      and action = 'support_access_requested'
      and outcome = 'denied'
  ),
  1::bigint,
  'a stale TOTP denial is retained as a durable audit event'
);

update private.auth_session_state
set established_at = now() - interval '8 hours 1 second',
    last_human_activity_at = now()
where session_id = '43000000-0000-0000-0000-000000000001';
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000001"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'the eight-hour session bound remains enforced after a reload'
);
select is(
  public.touch_session_state(),
  false,
  'a maximum-expired state cannot be extended by a touch'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '41000000-0000-0000-0000-000000000001',
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', '43000000-0000-0000-0000-000000000001',
    'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::integer))
  )::text,
  true
);

select is(
  public.establish_session_state(),
  false,
  'a fresh TOTP confirmation cannot restore a maximum-expired session'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1","session_id":"43000000-0000-0000-0000-000000000001"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'an AAL1 session cannot read a protected profile'
);
select is(
  (select count(*) from public.practice),
  0::bigint,
  'an AAL1 session cannot read a protected practice'
);
select is(
  public.request_support_access(8),
  null::uuid,
  'an AAL1 session cannot request support access'
);
select is(
  public.revoke_support_access('44000000-0000-0000-0000-000000000002'),
  false,
  'an AAL1 session cannot revoke support access'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000099"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'a missing or revoked session cannot read a protected profile'
);
select is(
  public.request_support_access(8),
  null::uuid,
  'a missing or revoked session cannot request support access'
);
select is(
  public.revoke_support_access('44000000-0000-0000-0000-000000000002'),
  false,
  'a missing or revoked session cannot revoke support access'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000004"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'an expired session cannot read a protected profile'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000003"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

reset role;
update auth.users
set banned_until = now() + interval '1 hour'
where id = '41000000-0000-0000-0000-000000000004';

select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000003"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'a currently banned user cannot read a protected profile'
);

reset role;
update auth.users
set banned_until = null,
    deleted_at = now()
where id = '41000000-0000-0000-0000-000000000004';

select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000003"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'a deleted user cannot read a protected profile'
);

reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'missing JWT claims cannot read a protected profile'
);

reset role;
select set_config('request.jwt.claims', '[]', true);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.request_support_access(8),
  null::uuid,
  'a non-object JWT claims value cannot request support access'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"not-a-uuid","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000001"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.request_support_access(8),
  null::uuid,
  'an invalid JWT sub cannot request support access'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000001"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'a missing JWT sub cannot read a protected profile'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"not-a-uuid"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.request_support_access(8),
  null::uuid,
  'an invalid JWT session ID cannot request support access'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'a missing JWT session ID cannot read a protected profile'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000002"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.request_support_access(8),
  null::uuid,
  'a JWT sub that differs from auth.uid cannot request support access'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"43000000-0000-0000-0000-000000000002"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  0::bigint,
  'a syntactically valid session owned by another user cannot read a protected profile'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1","session_id":"43000000-0000-0000-0000-000000000002"}',
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.is_portal_admin(),
  false,
  'an AAL1 portaladmin session cannot resolve portal-admin status'
);
select is(
  public.activate_support_access(
    '44000000-0000-0000-0000-000000000002',
    'account_support'
  ),
  null::jsonb,
  'an AAL1 portaladmin session cannot activate support access'
);
select is(
  (
    select count(*)
    from public.read_audit_events(
      '42000000-0000-0000-0000-000000000001',
      now(),
      50
    )
  ),
  0::bigint,
  'an AAL1 portaladmin session cannot read audit events'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_denied_audit_read()',
    'EXECUTE'
  ),
  'the denied-audit writer is not directly callable by authenticated sessions'
);

reset role;
delete from private.auth_session_state
where session_id = '43000000-0000-0000-0000-000000000001';
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '41000000-0000-0000-0000-000000000001',
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', '43000000-0000-0000-0000-000000000001',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'totp',
        'timestamp', extract(epoch from now() - interval '4 minutes 59 seconds')::integer
      )
    )
  )::text,
  true
);
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.establish_session_state(),
  true,
  'an almost-expired TOTP confirmation can establish initial session state'
);
select is(
  public.establish_session_state(),
  true,
  'an almost-expired TOTP confirmation can refresh existing session state'
);

reset role;
select ok(
  (
    select fresh_totp_at < now() - interval '4 minutes 58 seconds'
    from private.auth_session_state
    where session_id = '43000000-0000-0000-0000-000000000001'
  ),
  'establishing state does not extend an almost-expired TOTP confirmation'
);

select * from finish();
rollback;
