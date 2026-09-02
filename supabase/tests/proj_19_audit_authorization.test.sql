begin;

select plan(72);

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
  ('11000000-0000-0000-0000-000000000004', 'proj19-portal-admin-two@example.invalid'),
  ('11000000-0000-0000-0000-000000000005', 'proj19-unknown-authenticated@example.invalid'),
  ('11000000-0000-0000-0000-000000000006', 'proj19-foreign-praxisadmin@example.invalid');

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
  ),
  (
    '11000000-0000-0000-0000-000000000006',
    '21000000-0000-0000-0000-000000000002',
    'PROJ-19 Fremde Praxisadmin',
    'praxisadmin'
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
select throws_ok(
  $$
    insert into public.user_profile (user_id, practice_id, display_name, role)
    values (
      '11000000-0000-0000-0000-000000000003',
      '21000000-0000-0000-0000-000000000001',
      'PROJ-19 Forbidden Portal Profile',
      'rezeption'
    )
  $$,
  '23514',
  null,
  'a portal-admin identity cannot become a practice member'
);
select throws_ok(
  $$
    insert into public.portal_admin (user_id)
    values ('11000000-0000-0000-0000-000000000001')
  $$,
  '23514',
  null,
  'a practice member cannot become a portal-admin identity'
);

select ok(
  has_function_privilege('authenticated', 'public.is_portal_admin()', 'EXECUTE'),
  'authenticated identities can execute only the own-identity portal-admin check'
);
select ok(
  not has_function_privilege('anon', 'public.is_portal_admin()', 'EXECUTE'),
  'anonymous identities cannot execute the portal-admin check'
);
select has_function(
  'public',
  'record_denied_audit_read',
  array[]::text[],
  'the denied audit-read recorder accepts no caller-supplied target'
);
select is(
  (
    select has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'record_denied_audit_read'
      and procedure.pronargs = 0
  ),
  true,
  'authenticated identities can execute the no-target denied audit recorder'
);
select is(
  (
    select has_function_privilege('anon', procedure.oid, 'EXECUTE')
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'record_denied_audit_read'
      and procedure.pronargs = 0
  ),
  false,
  'anonymous identities cannot execute the denied audit recorder'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.is_portal_admin(),
  true,
  'the authenticated portal-admin check resolves only the calling provider identity'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.is_portal_admin(),
  false,
  'a practice-member identity is never resolved as a portal admin'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.is_portal_admin(),
  false,
  'an unassigned authenticated identity is never resolved as a portal admin'
);

reset role;

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select set_config(
  'proj_19.first_grant_id',
  public.request_support_access(8)::text,
  true
);
select ok(
  current_setting('proj_19.first_grant_id')::uuid is not null,
  'the owning praxisadmin receives a transaction-local support-grant UUID for its own practice'
);

reset role;
set local role service_role;

select ok(
  (
    select requested_duration_hours = 8
      and activation_deadline = requested_at + interval '24 hours'
      and expires_at is null
    from public.support_access_grant
    where id = current_setting('proj_19.first_grant_id')::uuid
  ),
  'a requested grant records its duration and activation deadline without starting access'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.request_support_access(25),
  null::uuid,
  'a requested support-access duration over 24 hours is neutrally denied'
);
select throws_ok(
  $$ select public.request_support_access(interval '-1 month 31 days') $$,
  '42883',
  null,
  'calendar-component intervals are rejected at the RPC type boundary'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.request_support_access(8),
  null::uuid,
  'a non-praxisadmin support request is neutrally denied'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.request_support_access(8),
  null::uuid,
  'an authenticated identity without a controlled role is neutrally denied'
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
  ),
  0::bigint,
  'a portal admin receives no audit events before activation'
);
select set_config(
  'proj_19.first_activation_result',
  public.activate_support_access(
    current_setting('proj_19.first_grant_id')::uuid,
    'technical_investigation'
  )::text,
  true
);
select is(
  (current_setting('proj_19.first_activation_result')::jsonb ->> 'practice_id')::uuid,
  '21000000-0000-0000-0000-000000000001'::uuid,
  'activation returns exactly the practice authorized by the opaque grant'
);
select ok(
  (current_setting('proj_19.first_activation_result')::jsonb ->> 'expires_at') is not null,
  'activation returns the corresponding expiry alongside the authorized practice'
);

reset role;
set local role service_role;

select ok(
  (
    select requested_duration_hours = 8
      and activation_deadline = requested_at + interval '24 hours'
    from public.support_access_grant
    where id = current_setting('proj_19.first_grant_id')::uuid
  ),
  'an active grant retains its requested duration and 24-hour activation deadline'
);
select is(
  (
    select count(*)
    from public.audit_event
    where action = 'support_access_requested' and outcome = 'denied'
  ),
  3::bigint,
  'denied support requests are retained without disclosing a practice or grant'
);
select is(
  (
    select actor_type::text
    from public.audit_event
    where actor_id = '11000000-0000-0000-0000-000000000005'
      and action = 'support_access_requested'
      and outcome = 'denied'
    order by occurred_at desc, id desc
    limit 1
  ),
  'unknown_authenticated',
  'an authenticated identity without a profile or portal mapping has a controlled unknown actor type'
);
select is(
  (
    select count(*)
    from public.audit_event
    where action = 'audit_read' and outcome = 'denied'
  ),
  1::bigint,
  'a denied pre-activation audit read is retained'
);
select ok(
  (
    select expires_at = activated_at
        + pg_catalog.make_interval(hours => requested_duration_hours)
      and expires_at > activated_at
    from public.support_access_grant
    where id = current_setting('proj_19.first_grant_id')::uuid
  ),
  'active support duration begins on activation'
);

select lives_ok(
  $$
    insert into public.audit_event (
      id,
      practice_id,
      actor_id,
      actor_type,
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
      'practice_member',
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
select is(
  (
    select actor_type::text
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000001',
      now(),
      50
    )
    where resource_id = '91000000-0000-0000-0000-000000000001'
  ),
  'practice_member',
  'an allowed audit read includes the controlled actor type'
);
select is(
  (
    select event_id
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000001',
      now(),
      50
    )
    where resource_id = '91000000-0000-0000-0000-000000000001'
  ),
  '91000000-0000-0000-0000-000000000001'::uuid,
  'an allowed audit read returns each audit event unique ID'
);

reset role;
set local role service_role;

select is(
  (
    select count(*)
    from public.audit_event
    where action = 'audit_read' and outcome = 'allowed'
  ),
  3::bigint,
  'each allowed audit read records itself exactly once'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000002',
      now(),
      50
    )
  ),
  0::bigint,
  'an active grant for one practice reveals no foreign audit events'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.activate_support_access(
    current_setting('proj_19.first_grant_id')::uuid,
    'technical_investigation'
  ),
  null::jsonb,
  'a second portal admin cannot reuse another portal admin grant'
);
select is(
  (
    select count(*)
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000001',
      now(),
      50
    )
  ),
  0::bigint,
  'an ungranted portal admin cannot read through another portal admin grant'
);

reset role;
set local role service_role;

select is(
  (
    select count(*)
    from public.audit_event
    where action = 'support_access_activated' and outcome = 'denied'
  ),
  1::bigint,
  'a denied activation is retained'
);
select is(
  (
    select practice_id
    from public.audit_event
    where actor_id = '11000000-0000-0000-0000-000000000004'
      and action = 'support_access_activated'
      and outcome = 'denied'
    order by occurred_at desc, id desc
    limit 1
  ),
  null::uuid,
  'a denied portal activation never records the opaque grant target practice'
);
select is(
  (
    select count(*)
    from public.audit_event
    where action = 'audit_read' and outcome = 'denied'
  ),
  3::bigint,
  'foreign and ungranted audit reads are retained'
);
select is(
  (
    select practice_id
    from public.audit_event
    where actor_id = '11000000-0000-0000-0000-000000000003'
      and action = 'audit_read'
      and outcome = 'denied'
    order by occurred_at desc, id desc
    limit 1
  ),
  null::uuid,
  'a denied portal audit read never records the requested foreign practice'
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
select is(
  public.revoke_support_access(
    current_setting('proj_19.first_grant_id')::uuid
  ),
  false,
  'a non-praxisadmin support revocation is neutrally denied'
);

reset role;
set local role service_role;

insert into public.support_access_grant (
  id,
  practice_id,
  requested_by,
  requested_duration_hours,
  activation_deadline
)
values (
  '31000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000002',
  '11000000-0000-0000-0000-000000000006',
  8,
  now() + interval '24 hours'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.revoke_support_access('31000000-0000-0000-0000-000000000001'),
  false,
  'a praxisadmin cannot revoke a foreign practice grant'
);

reset role;
set local role service_role;

select is(
  (
    select practice_id
    from public.audit_event
    where actor_id = '11000000-0000-0000-0000-000000000001'
      and action = 'support_access_revoked'
      and outcome = 'denied'
    order by occurred_at desc, id desc
    limit 1
  ),
  '21000000-0000-0000-0000-000000000001'::uuid,
  'a denied foreign-grant revocation is audited only under the caller practice'
);
select is(
  (
    select count(*)
    from public.audit_event
    where actor_id = '11000000-0000-0000-0000-000000000001'
      and action = 'support_access_revoked'
      and outcome = 'denied'
      and practice_id = '21000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'a denied foreign-grant revocation never records the guessed target practice'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.revoke_support_access(
    current_setting('proj_19.first_grant_id')::uuid
  ),
  true,
  'the owning praxisadmin can revoke its support grant'
);

reset role;
set local role service_role;

select is(
  (
    select count(*)
    from public.audit_event
    where action = 'support_access_revoked' and outcome = 'denied'
  ),
  2::bigint,
  'denied support revocations are retained'
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
  ),
  0::bigint,
  'a revoked grant immediately returns no audit events'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select set_config(
  'proj_19.replacement_grant_id',
  public.request_support_access(8)::text,
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
    set requested_at = now() - interval '10 hours',
        activation_deadline = now() + interval '14 hours',
        activated_at = now() - interval '9 hours',
        expires_at = now() - interval '1 hour'
    where id = current_setting('proj_19.replacement_grant_id')::uuid
  $$,
  'the synthetic fixture can model an expired active grant'
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
  ),
  0::bigint,
  'an expired grant immediately returns no audit events'
);

reset role;
set local role service_role;

select is(
  (
    select count(*)
    from public.audit_event
    where action = 'audit_read' and outcome = 'denied'
  ),
  5::bigint,
  'revoked and expired audit reads are retained'
);

reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  public.record_denied_audit_read(),
  false,
  'the no-target recorder returns only a neutral denial'
);
select is(
  (
    select count(*)
    from public.read_audit_events(
      '21000000-0000-0000-0000-000000000002',
      now(),
      50
    )
  ),
  0::bigint,
  'a direct practice-role read of a foreign target returns no audit contents'
);

reset role;
set local role service_role;

select is(
  (
    select count(*)
    from public.audit_event
    where actor_id = '11000000-0000-0000-0000-000000000002'
      and action = 'audit_read'
      and outcome = 'denied'
      and practice_id = '21000000-0000-0000-0000-000000000001'
  ),
  2::bigint,
  'server and direct denied reads are audited only under the caller practice'
);
select is(
  (
    select count(*)
    from public.audit_event
    where actor_id = '11000000-0000-0000-0000-000000000002'
      and action = 'audit_read'
      and outcome = 'denied'
      and practice_id = '21000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'denied practice-role reads never record the requested foreign practice'
);

select lives_ok(
  $$
    insert into public.audit_event (
      id,
      practice_id,
      actor_id,
      actor_type,
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
        'practice_member',
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
        'practice_member',
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
        'practice_member',
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
