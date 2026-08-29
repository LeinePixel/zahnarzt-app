-- Resolves only the currently authenticated account's provider identity.
-- No practice or other account data is exposed by this server-side precheck.
create function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.portal_admin as portal_admin
      where portal_admin.user_id = auth.uid()
    );
$$;

revoke all on function public.is_portal_admin() from public, anon, authenticated;
grant execute on function public.is_portal_admin() to authenticated;
