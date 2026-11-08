-- Keep room members visible even if an older/incomplete account has no profile row.
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
  select rm.user_id, coalesce(nullif(btrim(p.display_name), ''), 'Jogador'), rm.role, rm.joined_at
  from public.room_members rm
  left join public.profiles p on p.id = rm.user_id
  where rm.room_id = p_room_id
  order by case when rm.role = 'master' then 0 else 1 end, rm.joined_at, rm.user_id;
end;
$$;

revoke all on function public.get_room_participants(uuid) from public, anon, authenticated;
grant execute on function public.get_room_participants(uuid) to authenticated;
