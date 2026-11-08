-- Permanently delete a room and its room-owned records. Original Nativas
-- remain untouched because the RPC deletes only the room root row.
create or replace function public.delete_room(
  p_room_id uuid,
  p_confirmation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_creator uuid;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select r.created_by, r.name
  into v_creator, v_name
  from public.rooms r
  where r.id = p_room_id
  for update;

  if not found or v_creator <> v_user_id or not nativa_private.is_room_master(p_room_id) then
    raise exception 'room delete denied' using errcode = '42501';
  end if;
  if p_confirmation is distinct from v_name then
    raise exception 'room name confirmation mismatch' using errcode = '22023';
  end if;

  delete from public.rooms where id = p_room_id;
end
$function$;

revoke all on function public.delete_room(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_room(uuid, text) to authenticated;
