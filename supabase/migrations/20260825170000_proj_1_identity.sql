create type public.user_role as enum (
  'rezeption',
  'behandler',
  'praxisadmin'
);

create table public.practice (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint practice_name_not_blank
    check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.user_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  practice_id uuid not null references public.practice(id) on delete restrict,
  display_name text not null constraint user_profile_display_name_not_blank
    check (length(btrim(display_name)) > 0),
  role public.user_role not null,
  created_at timestamptz not null default now()
);

create index user_profile_practice_id_idx
  on public.user_profile (practice_id);

alter table public.practice enable row level security;
alter table public.user_profile enable row level security;

-- Data API access is deliberately allow-listed. The browser roles receive no
-- INSERT, UPDATE or DELETE grants. Only the secret CLI administration role
-- can provision the synthetic practice, accounts and profiles.
revoke all on table public.practice from public, anon, authenticated;
revoke all on table public.user_profile from public, anon, authenticated;
grant select on table public.practice to authenticated;
grant select on table public.user_profile to authenticated;
grant select, insert, update, delete on table public.practice to service_role;
grant select, insert, update, delete on table public.user_profile to service_role;

create policy "users can read only their own profile"
  on public.user_profile
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can read only their own practice"
  on public.practice
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_profile
      where user_profile.practice_id = practice.id
        and user_profile.user_id = (select auth.uid())
    )
  );

comment on table public.practice is
  'Tenant boundary for a dental practice; contains no patient data.';
comment on table public.user_profile is
  'Minimal staff identity and authorization mapping; no patient data.';
