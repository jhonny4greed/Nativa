-- Safe read RPCs required by the room UI. Room memberships and invite hashes
-- remain inaccessible through direct client table reads.

create or replace function public.get_room_participants(p_room_id uuid)
returns table (
  user_id uuid,
  display_name text,
  role text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = auth.uid()
  ) then
    raise exception 'room member required' using errcode = '42501';
  end if;

  return query
  select rm.user_id, p.display_name, rm.role, rm.joined_at
  from public.room_members rm
  join public.profiles p on p.id = rm.user_id
  where rm.room_id = p_room_id
  order by case when rm.role = 'master' then 0 else 1 end, rm.joined_at, rm.user_id;
end;
$$;

create or replace function public.list_room_invites(p_room_id uuid)
returns table (
  id uuid,
  kind text,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer,
  revoked_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = auth.uid()
      and rm.role = 'master'
  ) then
    raise exception 'room master required' using errcode = '42501';
  end if;

  return query
  select ri.id, ri.kind, ri.expires_at, ri.max_uses, ri.uses_count, ri.revoked_at, ri.created_at
  from public.room_invites ri
  where ri.room_id = p_room_id
  order by ri.created_at desc, ri.id;
end;
$$;

revoke all on function public.get_room_participants(uuid) from public, anon, authenticated;
revoke all on function public.list_room_invites(uuid) from public, anon, authenticated;
grant execute on function public.get_room_participants(uuid) to authenticated;
grant execute on function public.list_room_invites(uuid) to authenticated;
