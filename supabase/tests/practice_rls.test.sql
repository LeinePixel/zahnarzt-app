begin;

select plan(16);

select has_table('public', 'practice', 'practice table exists');
select col_is_pk('public', 'practice', 'id', 'practice.id is the primary key');
select col_not_null('public', 'practice', 'name', 'practice.name is required');
select ok(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'practice'
  ),
  'RLS is enabled on practice'
);
select ok(
  has_table_privilege('service_role', 'public.practice', 'SELECT')
    and has_table_privilege('service_role', 'public.practice', 'INSERT')
    and has_table_privilege('service_role', 'public.practice', 'UPDATE')
    and has_table_privilege('service_role', 'public.practice', 'DELETE'),
  'service_role can provision practices through the CLI seed'
);

select throws_ok(
  $$ insert into public.practice (name) values ('   ') $$,
  '23514',
  null,
  'blank practice names are rejected'
);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'rls-one@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'rls-two@example.invalid');

insert into auth.sessions (id, user_id, aal, not_after)
values
  (
    '10100000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'aal2',
    now() + interval '8 hours'
  ),
  (
    '10100000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'aal2',
    now() + interval '8 hours'
  );

insert into public.practice (id, name)
values
  ('20000000-0000-0000-0000-000000000001', 'Testpraxis Eins'),
  ('20000000-0000-0000-0000-000000000002', 'Testpraxis Zwei');

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
  $$ select * from public.practice $$,
  '42501',
  null,
  'anonymous users cannot read practices'
);
select throws_ok(
  $$ insert into public.practice (name) values ('Nicht erlaubt') $$,
  '42501',
  null,
  'anonymous users cannot insert practices'
);
select throws_ok(
  $$ update public.practice set name = 'Nicht erlaubt' $$,
  '42501',
  null,
  'anonymous users cannot update practices'
);
select throws_ok(
  $$ delete from public.practice $$,
  '42501',
  null,
  'anonymous users cannot delete practices'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","session_id":"10100000-0000-0000-0000-000000000001"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.practice),
  1::bigint,
  'authenticated users see exactly their own practice'
);
select is(
  (
    select name
    from public.practice
    where id = '20000000-0000-0000-0000-000000000001'
  ),
  'Testpraxis Eins',
  'authenticated users can read their own practice'
);
select is(
  (
    select count(*)
    from public.practice
    where id = '20000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'a foreign practice remains invisible'
);

select throws_ok(
  $$ insert into public.practice (name) values ('Nicht erlaubt') $$,
  '42501',
  null,
  'authenticated users cannot insert practices'
);
select throws_ok(
  $$ update public.practice set name = 'Nicht erlaubt' $$,
  '42501',
  null,
  'authenticated users cannot update practices'
);
select throws_ok(
  $$ delete from public.practice $$,
  '42501',
  null,
  'authenticated users cannot delete practices'
);

reset role;
select * from finish();
rollback;
