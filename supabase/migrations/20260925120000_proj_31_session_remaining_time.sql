create function public.current_session_remaining_ms()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.has_valid_aal2_session() then 0
    else coalesce((
      select greatest(
        0,
        least(
          300000,
          pg_catalog.floor(
            extract(epoch from (
              least(
                state.last_human_activity_at + interval '5 minutes',
                state.started_at + interval '8 hours'
              ) - pg_catalog.now()
            )) * 1000
          )::integer
        )
      )
      from private.session_security_state as state
      where state.session_id = private.current_session_id()
        and state.user_id = auth.uid()
    ), 0)
  end;
$$;

revoke all on function public.current_session_remaining_ms()
  from public, anon, authenticated;
grant execute on function public.current_session_remaining_ms()
  to authenticated;
