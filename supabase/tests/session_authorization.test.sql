begin;

select plan(14);

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
  1::bigint,
  'a current matching AAL2 session can read its own protected profile'
);
select is(
  (select count(*) from public.practice),
  1::bigint,
  'a current matching AAL2 session can read its own protected practice'
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
select * from finish();
rollback;
