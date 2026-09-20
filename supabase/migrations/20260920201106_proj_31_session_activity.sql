create function public.record_current_session_activity()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid := private.current_session_id();
  v_user_id uuid := auth.uid();
begin
  if v_session_id is null
    or v_user_id is null
    or auth.jwt() ->> 'aal' <> 'aal2' then
    return false;
  end if;

  update private.session_security_state as state
  set last_human_activity_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  from auth.sessions as session, auth.users as auth_user
  where state.session_id = v_session_id
    and state.user_id = v_user_id
    and session.id = state.session_id
    and session.user_id = state.user_id
    and session.aal = 'aal2'
    and (session.not_after is null or session.not_after > pg_catalog.now())
    and auth_user.id = state.user_id
    and auth_user.deleted_at is null
    and (auth_user.banned_until is null or auth_user.banned_until <= pg_catalog.now())
    and state.revoked_at is null
    and state.last_human_activity_at + interval '5 minutes' > pg_catalog.now()
    and state.started_at + interval '8 hours' > pg_catalog.now();

  return found;
end;
$$;

revoke all on function public.record_current_session_activity()
  from public, anon, authenticated;
grant execute on function public.record_current_session_activity()
  to authenticated;
