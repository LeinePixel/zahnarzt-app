-- The TOTP AMR timestamp is the reauthentication boundary. It may precede the
-- server-side state that is established immediately afterwards.
alter table private.auth_session_state
  drop constraint if exists auth_session_state_check1;

create or replace function private.latest_fresh_totp_amr_at()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := auth.jwt();
  v_totp_at timestamptz;
begin
  if jsonb_typeof(v_claims -> 'amr') is distinct from 'array' then
    return null;
  end if;

  select max(pg_catalog.to_timestamp((amr_entry.value ->> 'timestamp')::numeric))
  into v_totp_at
  from jsonb_array_elements(v_claims -> 'amr') as amr_entry(value)
  where jsonb_typeof(amr_entry.value) = 'object'
    and amr_entry.value ->> 'method' in ('totp', 'mfa/totp')
    and jsonb_typeof(amr_entry.value -> 'timestamp') = 'number'
    and (amr_entry.value ->> 'timestamp')::numeric
      between extract(epoch from pg_catalog.now() - interval '5 minutes')
        and extract(epoch from pg_catalog.now() + interval '1 minute');

  return v_totp_at;
exception
  when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    return null;
end;
$$;

create or replace function public.establish_session_state()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_fresh_totp_at timestamptz := private.latest_fresh_totp_amr_at();
begin
  if not private.has_current_aal2_identity()
    or v_fresh_totp_at is null then
    return false;
  end if;

  begin
    v_session_id := (auth.jwt() ->> 'session_id')::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  insert into private.auth_session_state (
    session_id,
    user_id,
    established_at,
    last_human_activity_at,
    fresh_totp_at
  )
  values (
    v_session_id,
    auth.uid(),
    pg_catalog.now(),
    pg_catalog.now(),
    v_fresh_totp_at
  )
  on conflict (session_id) do update
  set last_human_activity_at = excluded.last_human_activity_at,
      fresh_totp_at = excluded.fresh_totp_at
  where private.auth_session_state.user_id = auth.uid()
    and private.auth_session_state.established_at > pg_catalog.now() - interval '8 hours';

  return found;
end;
$$;

revoke all on function private.latest_fresh_totp_amr_at() from public, anon, authenticated;
