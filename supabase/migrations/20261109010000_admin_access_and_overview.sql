-- Keep application access consistent with the existing profiles.role backend.
-- The RLS admin policy needs EXECUTE on its helper for authenticated requests.
grant execute on function nativa_private.is_admin(uuid) to authenticated;

create or replace function public.get_application_role()
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return coalesce((select role from public.profiles where id = auth.uid()), 'player');
end;
$$;
revoke all on function public.get_application_role() from public, anon;
grant execute on function public.get_application_role() to authenticated;

create or replace function public.get_admin_overview()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not nativa_private.is_admin(auth.uid()) then
    raise exception 'application admin required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'players', (select count(*) from public.profiles),
    'nativas', (select count(*) from public.nativas),
    'rooms', (select count(*) from public.rooms where status = 'open')
  );
end;
$$;
revoke all on function public.get_admin_overview() from public, anon;
grant execute on function public.get_admin_overview() to authenticated;
