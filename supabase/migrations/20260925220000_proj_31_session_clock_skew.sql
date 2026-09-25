-- Auth and database clocks can differ slightly. Keep the absolute session
-- start conservative so a future auth timestamp cannot violate private state.
create or replace function public.initialize_current_session()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := private.current_session_id();
  v_session auth.sessions%rowtype;
begin
  if v_user_id is null
    or v_session_id is null
    or auth.jwt() ->> 'aal' <> 'aal2' then
    return false;
  end if;

  select session.*
  into v_session
  from auth.sessions as session
  join auth.users as auth_user on auth_user.id = session.user_id
  where session.id = v_session_id
    and session.user_id = v_user_id
    and session.aal = 'aal2'
    and (session.not_after is null or session.not_after > pg_catalog.now())
    and auth_user.deleted_at is null
    and (
      auth_user.banned_until is null
      or auth_user.banned_until <= pg_catalog.now()
    );

  if not found
    or v_session.created_at is null
    or v_session.created_at + interval '8 hours' <= pg_catalog.now() then
    return false;
  end if;

  insert into private.session_security_state (
    session_id,
    user_id,
    started_at,
    last_human_activity_at
  )
  values (
    v_session.id,
    v_user_id,
    least(v_session.created_at, pg_catalog.now()),
    pg_catalog.now()
  )
  on conflict (session_id) do nothing;

  return private.has_valid_aal2_session();
end;
$$;
