create type public.integration_provider as enum ('mock_pvs');
create type public.integration_sync_status as enum ('idle','healthy','retry_scheduled','failed');
create type public.integration_sync_error_code as enum ('rate_limited','temporarily_unavailable','network_unavailable','source_contract_invalid','source_protocol_invalid','configuration_invalid');
create table public.integration (
 id uuid primary key default gen_random_uuid(),
 practice_id uuid not null references public.practice(id) on delete cascade,
 provider public.integration_provider not null,
 created_at timestamptz not null default now(),
 unique(practice_id,provider)
);
create table public.integration_sync_state (
 integration_id uuid primary key references public.integration(id) on delete cascade,
 status public.integration_sync_status not null default 'idle',
 confirmed_change_cursor text check(length(confirmed_change_cursor) between 1 and 128),
 last_attempt_at timestamptz,
 last_success_at timestamptz,
 next_attempt_at timestamptz,
 last_error_code public.integration_sync_error_code,
 updated_at timestamptz not null default now(),
 constraint integration_state_consistency check (
  (status='idle' and last_error_code is null and next_attempt_at is null and last_attempt_at is null and last_success_at is null) or
  (status='healthy' and last_error_code is null and next_attempt_at is null and last_attempt_at is not null and last_success_at is not null) or
  (status='failed' and last_error_code is not null and next_attempt_at is null and last_attempt_at is not null) or
  (status='retry_scheduled' and last_error_code in ('rate_limited','temporarily_unavailable','network_unavailable') and next_attempt_at is not null and last_attempt_at is not null and next_attempt_at>last_attempt_at and next_attempt_at<=last_attempt_at+interval '5 minutes')
 )
);
create table public.integration_sync_event (
 id uuid primary key default gen_random_uuid(),
 integration_id uuid not null references public.integration(id) on delete cascade,
 outcome text not null check(outcome in ('succeeded','failed')),
 error_code public.integration_sync_error_code,
 attempted_at timestamptz not null default now(),
 retry_at timestamptz,
 check ((outcome='succeeded' and error_code is null and retry_at is null) or (outcome='failed' and error_code is not null)),
 check(retry_at is null or (error_code in ('rate_limited','temporarily_unavailable','network_unavailable') and retry_at>attempted_at and retry_at<=attempted_at+interval '5 minutes'))
);
create index integration_sync_event_retention on public.integration_sync_event(attempted_at);
create index integration_sync_event_integration on public.integration_sync_event(integration_id);
create index integration_sync_state_due on public.integration_sync_state(next_attempt_at) where status='retry_scheduled';
alter table public.integration enable row level security;
alter table public.integration_sync_state enable row level security;
alter table public.integration_sync_event enable row level security;
revoke all on public.integration,public.integration_sync_state,public.integration_sync_event from public,anon,authenticated;
grant all on public.integration,public.integration_sync_state,public.integration_sync_event to service_role;

create function private.initialize_integration_sync_state() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.integration_sync_state(integration_id) values(new.id);
 return new;
end;
$$;
revoke all on function private.initialize_integration_sync_state() from public,anon,authenticated,service_role;
create trigger initialize_integration_sync_state after insert on public.integration for each row execute function private.initialize_integration_sync_state();

create function public.read_integration_sync_status()
returns table(integration_id uuid,provider public.integration_provider,status public.integration_sync_status,last_attempt_at timestamptz,last_success_at timestamptz,next_attempt_at timestamptz,last_error_code public.integration_sync_error_code)
language sql security definer set search_path='' stable as $$
 select i.id,i.provider,s.status,s.last_attempt_at,s.last_success_at,s.next_attempt_at,s.last_error_code
 from public.user_profile p join public.integration i on i.practice_id=p.practice_id join public.integration_sync_state s on s.integration_id=i.id
 where p.user_id=auth.uid() and p.role='praxisadmin'
$$;
revoke all on function public.read_integration_sync_status() from public,anon,authenticated,service_role;
grant execute on function public.read_integration_sync_status() to authenticated;

create function private.record_integration_sync_result(p_integration_id uuid,p_outcome text,p_error_code public.integration_sync_error_code,p_retry_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare v_attempted_at timestamptz:=clock_timestamp(); v_retry_at timestamptz; v_status public.integration_sync_status;
begin
 if p_outcome is null or p_outcome not in ('succeeded','failed') or (p_outcome='succeeded' and (p_error_code is not null or p_retry_at is not null)) or (p_outcome='failed' and p_error_code is null) then
  raise exception 'Invalid integration result' using errcode='22023';
 end if;
 if p_outcome='succeeded' then v_status:='healthy';
 elsif p_error_code in ('rate_limited','temporarily_unavailable','network_unavailable') then
  v_status:='retry_scheduled';
  v_retry_at:=case when p_retry_at>v_attempted_at and p_retry_at<=v_attempted_at+interval '5 minutes' then p_retry_at else v_attempted_at+interval '1 minute' end;
 else
  if p_retry_at is not null then raise exception 'Invalid integration result' using errcode='22023'; end if;
  v_status:='failed';
 end if;
 update public.integration_sync_state set status=v_status,last_attempt_at=v_attempted_at,last_success_at=case when p_outcome='succeeded' then v_attempted_at else last_success_at end,next_attempt_at=v_retry_at,last_error_code=p_error_code,updated_at=v_attempted_at where integration_id=p_integration_id;
 if not found then raise exception 'Unknown integration' using errcode='22023'; end if;
 insert into public.integration_sync_event(integration_id,outcome,error_code,attempted_at,retry_at) values(p_integration_id,p_outcome,p_error_code,v_attempted_at,v_retry_at);
end;
$$;
create function private.confirm_integration_change_cursor(p_integration_id uuid,p_cursor text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_cursor is null or length(p_cursor) not between 1 and 128 then raise exception 'Invalid integration cursor' using errcode='22023'; end if;
 update public.integration_sync_state set confirmed_change_cursor=p_cursor,updated_at=clock_timestamp() where integration_id=p_integration_id;
 if not found then raise exception 'Unknown integration' using errcode='22023'; end if;
end;
$$;
create function private.purge_expired_integration_sync_events()
returns bigint language plpgsql security definer set search_path='' as $$
declare v_deleted bigint;
begin
 delete from public.integration_sync_event where attempted_at<now()-interval '30 days';
 get diagnostics v_deleted=row_count;
 return v_deleted;
end;
$$;
revoke all on function private.record_integration_sync_result(uuid,text,public.integration_sync_error_code,timestamptz),private.confirm_integration_change_cursor(uuid,text),private.purge_expired_integration_sync_events() from public,anon,authenticated,service_role;
