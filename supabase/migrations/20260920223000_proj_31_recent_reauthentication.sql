create function private.has_recent_reauthentication()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_valid_aal2_session()
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(
            coalesce(
              nullif(current_setting('request.jwt.claims', true), ''),
              nullif(current_setting('request.jwt.claim', true), ''),
              '{}'
            )::jsonb -> 'amr'
          ) = 'array' then coalesce(
            nullif(current_setting('request.jwt.claims', true), ''),
            nullif(current_setting('request.jwt.claim', true), ''),
            '{}'
          )::jsonb -> 'amr'
          else '[]'::jsonb
        end
      ) as method
      where method ->> 'method' = 'totp'
        and method ->> 'timestamp' ~ '^[0-9]+$'
        and pg_catalog.to_timestamp((method ->> 'timestamp')::double precision)
          > pg_catalog.now() - interval '5 minutes'
        and pg_catalog.to_timestamp((method ->> 'timestamp')::double precision)
          <= pg_catalog.now() + interval '30 seconds'
    );
$$;

create or replace function public.activate_support_access(
  p_grant_id uuid,
  p_reason public.support_reason
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_recent_reauthentication() then
    return null;
  end if;

  return private.proj_19_activate_support_access(p_grant_id, p_reason);
end;
$$;

create or replace function public.read_audit_events(
  p_practice_id uuid,
  p_before timestamptz,
  p_limit integer
)
returns table (
  event_id uuid,
  actor_type public.audit_actor_type,
  actor_id uuid,
  occurred_at timestamptz,
  action public.audit_action,
  outcome public.audit_outcome,
  resource_type text,
  resource_id uuid,
  correlation_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_recent_reauthentication() then
    return;
  end if;

  return query
  select *
  from private.proj_19_read_audit_events(
    p_practice_id,
    p_before,
    p_limit
  );
end;
$$;

revoke all on function private.has_recent_reauthentication()
  from public, anon, authenticated;
