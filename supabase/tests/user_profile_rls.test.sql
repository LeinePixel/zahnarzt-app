begin;

select plan(20);

select has_table('public', 'user_profile', 'user_profile table exists');
select col_is_pk('public', 'user_profile', 'user_id', 'user_profile.user_id is the primary key');
select has_index(
  'public',
  'user_profile',
  'user_profile_practice_id_idx',
  'practice lookups have an index'
);
select col_not_null('public', 'user_profile', 'practice_id', 'practice_id is required');
select col_not_null('public', 'user_profile', 'display_name', 'display_name is required');
select is(
  (
    select string_agg(e.enumlabel::text, ',' order by e.enumsortorder)
    from pg_catalog.pg_enum as e
    join pg_catalog.pg_type as t on t.oid = e.enumtypid
    join pg_catalog.pg_namespace as n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ),
  'rezeption,behandler,praxisadmin',
  'user_role contains only the approved roles'
);
select ok(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'user_profile'
  ),
  'RLS is enabled on user_profile'
);
select ok(
  has_table_privilege('service_role', 'public.user_profile', 'SELECT')
    and has_table_privilege('service_role', 'public.user_profile', 'INSERT')
    and has_table_privilege('service_role', 'public.user_profile', 'UPDATE')
    and has_table_privilege('service_role', 'public.user_profile', 'DELETE'),
  'service_role can provision profiles through the CLI seed'
);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'profile-one@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'profile-two@example.invalid');

insert into auth.sessions (id, user_id, aal, not_after)
values
  (
    '10200000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'aal2',
    now() + interval '8 hours'
  ),
  (
    '10200000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'aal2',
    now() + interval '8 hours'
  );

insert into private.auth_session_state (session_id, user_id)
values
  (
    '10200000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '10200000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002'
  );

insert into public.practice (id, name)
values
  ('20000000-0000-0000-0000-000000000001', 'Testpraxis Eins'),
  ('20000000-0000-0000-0000-000000000002', 'Testpraxis Zwei');

select throws_ok(
  $$
    insert into public.user_profile (user_id, practice_id, display_name, role)
    values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '   ',
      'rezeption'
    )
  $$,
  '23514',
  null,
  'blank display names are rejected'
);

select throws_ok(
  $$
    insert into public.user_profile (user_id, practice_id, display_name, role)
    values (
      '10000000-0000-0000-0000-000000000001',
      '29999999-9999-9999-9999-999999999999',
      'Testperson',
      'rezeption'
    )
  $$,
  '23503',
  null,
  'profiles must reference an existing practice'
);

insert into public.user_profile (user_id, practice_id, display_name, role)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Testperson Eins',
    'praxisadmin'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Testperson Zwei',
    'behandler'
  );

set local role anon;
select throws_ok(
  $$ select * from public.user_profile $$,
  '42501',
  null,
  'anonymous users cannot read profiles'
);
select throws_ok(
  $$
    insert into public.user_profile (user_id, practice_id, display_name, role)
    values (
      '10000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000001',
      'Nicht erlaubt',
      'rezeption'
    )
  $$,
  '42501',
  null,
  'anonymous users cannot insert profiles'
);
select throws_ok(
  $$ update public.user_profile set display_name = 'Nicht erlaubt' $$,
  '42501',
  null,
  'anonymous users cannot update profiles'
);
select throws_ok(
  $$ delete from public.user_profile $$,
  '42501',
  null,
  'anonymous users cannot delete profiles'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"10200000-0000-0000-0000-000000000001"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.user_profile),
  1::bigint,
  'authenticated users see exactly their own profile'
);
select is(
  (select display_name from public.user_profile),
  'Testperson Eins',
  'authenticated users can read their own profile'
);
select is(
  (
    select count(*)
    from public.user_profile
    where user_id = '10000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'a foreign profile remains invisible'
);

select throws_ok(
  $$
    insert into public.user_profile (user_id, practice_id, display_name, role)
    values (
      '10000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000001',
      'Nicht erlaubt',
      'rezeption'
    )
  $$,
  '42501',
  null,
  'authenticated users cannot insert profiles'
);
select throws_ok(
  $$ update public.user_profile set display_name = 'Nicht erlaubt' $$,
  '42501',
  null,
  'authenticated users cannot update profiles'
);
select throws_ok(
  $$ delete from public.user_profile $$,
  '42501',
  null,
  'authenticated users cannot delete profiles'
);

reset role;
select * from finish();
rollback;
