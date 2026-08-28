begin;

select plan(37);

select has_table('public', 'portal_admin', 'portal admin identities are stored separately from practice roles');
select has_table('public', 'support_access_grant', 'practice-approved support access is stored explicitly');
select has_table('public', 'audit_event', 'audit events have a dedicated table');
select ok(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'audit_event'
  ),
  'RLS is enabled on audit events'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_event', 'SELECT'),
  'authenticated users have no direct audit-event SELECT grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_event', 'INSERT'),
  'authenticated users have no direct audit-event INSERT grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_event', 'UPDATE'),
  'authenticated users have no direct audit-event UPDATE grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_event', 'DELETE'),
  'authenticated users have no direct audit-event DELETE grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.portal_admin', 'SELECT')
    and not has_table_privilege('authenticated', 'public.portal_admin', 'INSERT')
    and not has_table_privilege('authenticated', 'public.portal_admin', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.portal_admin', 'DELETE'),
  'authenticated users have no direct portal-admin API table grants'
);
select ok(
  not has_table_privilege('authenticated', 'public.support_access_grant', 'SELECT')
    and not has_table_privilege('authenticated', 'public.support_access_grant', 'INSERT')
    and not has_table_privilege('authenticated', 'public.support_access_grant', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.support_access_grant', 'DELETE'),
  'authenticated users have no direct support-access-grant API table grants'
);

insert into auth.users (id, email)
values
  ('11000000-0000-0000-0000-000000000001', 'proj19-praxisadmin@example.invalid'),
  ('11000000-0000-0000-0000-000000000002', 'proj19-rezeption@example.invalid'),
  ('11000000-0000-0000-0000-000000000003', 'proj19-portal-admin-one@example.invalid'),
  ('11000000-0000-0000-0000-000000000004', 'proj19-portal-admin-two@example.invalid');

insert into public.practice (id, name)
values
  ('21000000-0000-0000-0000-000000000001', 'PROJ-19 Testpraxis Eins'),
  ('21000000-0000-0000-0000-000000000002', 'PROJ-19 Testpraxis Zwei');

insert into public.user_profile (user_id, practice_id, display_name, role)
values
  (
    '11000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    'PROJ-19 Praxisadmin',
    'praxisadmin'
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '21000000-0000-0000-0000-000000000001',
    'PROJ-19 Rezeption',
    'rezeption'
  );

select lives_ok(
  $$
    insert into public.portal_admin (user_id)
    values
      ('11000000-0000-0000-0000-000000000003'),
      ('11000000-0000-0000-0000-000000000004')
  $$,
  'two fixed provider identities can exist without a practice profile'
);

reset role;
set local role service_role;

select is(
  (
    select count(*)
    from public.user_profile
    where user_id in (
      '11000000-0000-0000-0000-000000000003',
      '11000000-0000-0000-0000-000000000004'
    )
  ),
  0::bigint,
  'portal-admin identities have no practice user-profile rows'
);

reset role;

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select set_config(
  'proj_19.first_grant_id',
  public.request_support_access(interval '8 hours')::text,
  true
);
select ok(
  current_setting('proj_19.first_grant_id')::uuid is not null,
  'the owning praxisadmin receives a transaction-local support-grant UUID for its own practice'
);
select throws_ok(
  $$ select public.request_support_access(interval '25 hours') $$,
  null,
  null,
  'a requested support-access duration over 24 hours is rejected'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$ select public.request_support_access(interval '8 hours') $$,
  '42501',
  null,
  'a non-praxisadmin cannot request support access'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select *
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000001',
      now(),
      50
    )
  $$,
  '42501',
  null,
  'a portal admin cannot read audit events before activation'
);
select lives_ok(
  $$
    select public.activate_support_access(
      current_setting('proj_19.first_grant_id')::uuid,
      'technical_investigation'
    )
  $$,
  'the first portal admin can activate the requested support access'
);

reset role;
set local role service_role;

select lives_ok(
  $$
    insert into public.audit_event (
      id,
      practice_id,
      actor_id,
      action,
      outcome,
      resource_type,
      resource_id,
      occurred_at,
      correlation_id
    )
    values (
      '91000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      '11000000-0000-0000-0000-000000000001',
      'support_access_requested',
      'allowed',
      'support_access_grant',
      '91000000-0000-0000-0000-000000000001',
      now(),
      '92000000-0000-0000-0000-000000000001'
    )
  $$,
  'the synthetic audit fixture can be provisioned only as service role'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000001',
      now(),
      50
    )
    where resource_id = '91000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'an activated portal admin receives the seeded audit event for the granted practice'
);

reset role;
set local role service_role;

select is(
  (select count(*) from public.audit_event where action = 'audit_read'),
  1::bigint,
  'an allowed audit read records itself exactly once'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select *
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000002',
      now(),
      50
    )
  $$,
  '42501',
  null,
  'an active grant for one practice does not reveal a foreign practice'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select public.activate_support_access(
      current_setting('proj_19.first_grant_id')::uuid,
      'technical_investigation'
    )
  $$,
  '42501',
  null,
  'a second portal admin cannot reuse another portal admin grant'
);
select throws_ok(
  $$
    select *
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000001',
      now(),
      50
    )
  $$,
  '42501',
  null,
  'an ungranted portal admin cannot read through another portal admin grant'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$ select * from public.audit_event $$,
  '42501',
  null,
  'authenticated users cannot directly select audit events'
);
select throws_ok(
  $$
    insert into public.audit_event (
      id,
      practice_id,
      actor_id,
      action,
      outcome,
      resource_type,
      resource_id,
      occurred_at,
      correlation_id
    )
    values (
      '91000000-0000-0000-0000-000000000002',
      '21000000-0000-0000-0000-000000000001',
      '11000000-0000-0000-0000-000000000002',
      'audit_read',
      'denied',
      'audit_event',
      '91000000-0000-0000-0000-000000000002',
      now(),
      '92000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  null,
  'authenticated users cannot directly insert audit events'
);
select throws_ok(
  $$ update public.audit_event set outcome = 'failed' $$,
  '42501',
  null,
  'authenticated users cannot directly update audit events'
);
select throws_ok(
  $$ delete from public.audit_event $$,
  '42501',
  null,
  'authenticated users cannot directly delete audit events'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.revoke_support_access(
      current_setting('proj_19.first_grant_id')::uuid
    )
  $$,
  'the owning praxisadmin can revoke its support grant'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select *
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000001',
      now(),
      50
    )
  $$,
  '42501',
  null,
  'a revoked grant immediately denies audit reads'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select set_config(
  'proj_19.replacement_grant_id',
  public.request_support_access(interval '8 hours')::text,
  true
);
select ok(
  current_setting('proj_19.replacement_grant_id')::uuid is not null,
  'the owning praxisadmin receives a transaction-local replacement-grant UUID'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.activate_support_access(
      current_setting('proj_19.replacement_grant_id')::uuid,
      'account_support'
    )
  $$,
  'a portal admin can activate a replacement grant'
);

reset role;
set local role service_role;

select lives_ok(
  $$
    update public.support_access_grant
    set requested_at = now() - interval '2 hours',
        expires_at = now() - interval '1 hour'
    where id = current_setting('proj_19.replacement_grant_id')::uuid
  $$,
  'the synthetic fixture can model an expired active grant'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$
    select *
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000001',
      now(),
      50
    )
  $$,
  '42501',
  null,
  'an expired grant immediately denies audit reads'
);

reset role;
set local role service_role;

select lives_ok(
  $$
    insert into public.audit_event (
      id,
      practice_id,
      actor_id,
      action,
      outcome,
      resource_type,
      resource_id,
      occurred_at,
      correlation_id
    )
    values
      (
        '91000000-0000-0000-0000-000000000003',
        '21000000-0000-0000-0000-000000000001',
        '11000000-0000-0000-0000-000000000001',
        'support_access_requested',
        'allowed',
        'support_access_grant',
        '91000000-0000-0000-0000-000000000003',
        now() - interval '91 days',
        '92000000-0000-0000-0000-000000000003'
      ),
      (
        '91000000-0000-0000-0000-000000000004',
        '21000000-0000-0000-0000-000000000001',
        '11000000-0000-0000-0000-000000000001',
        'support_access_requested',
        'allowed',
        'support_access_grant',
        '91000000-0000-0000-0000-000000000004',
        now() - interval '90 days',
        '92000000-0000-0000-0000-000000000004'
      ),
      (
        '91000000-0000-0000-0000-000000000005',
        '21000000-0000-0000-0000-000000000001',
        '11000000-0000-0000-0000-000000000001',
        'support_access_requested',
        'allowed',
        'support_access_grant',
        '91000000-0000-0000-0000-000000000005',
        now() - interval '89 days',
        '92000000-0000-0000-0000-000000000005'
      )
  $$,
  'the synthetic retention fixtures cover both sides of the 90-day boundary'
);
select lives_ok(
  $$ select private.purge_expired_audit_events() $$,
  'the private maintenance routine purges expired audit events'
);
select is(
  (
    select count(*)
    from public.audit_event
    where id in (
      '91000000-0000-0000-0000-000000000003',
      '91000000-0000-0000-0000-000000000004'
    )
  ),
  0::bigint,
  'the purge removes audit events at or before the 90-day boundary'
);
select is(
  (
    select count(*)
    from public.audit_event
    where id = '91000000-0000-0000-0000-000000000005'
  ),
  1::bigint,
  'the purge keeps audit events newer than the 90-day boundary'
);

reset role;
select * from finish();
rollback;
