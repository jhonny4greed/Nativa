-- Ensure authorization is decided before inspecting an update payload.
-- This avoids leaking validation details to a room peer who cannot edit the row.
create or replace function public.save_room_companion(
  p_companion_id uuid,
  p_expected_revision bigint,
  p_format_version integer,
  p_campaign_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_companion public.room_companions%rowtype;
  v_room_status text;
  v_new_revision bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_companion_id is null then
    raise exception 'room companion not found' using errcode = 'P0002';
  end if;

  select c.* into v_companion
  from public.room_companions c
  where c.id = p_companion_id
  for update;
  if not found then
    raise exception 'room companion not found' using errcode = 'P0002';
  end if;

  if not nativa_private.is_room_member(v_companion.room_id)
    or not (v_user_id = v_companion.player_id or nativa_private.is_room_master(v_companion.room_id)) then
    raise exception 'room companion access denied' using errcode = '42501';
  end if;
  if not v_companion.is_active then
    raise exception 'historical companion is read only' using errcode = '55000';
  end if;

  select r.status into v_room_status
  from public.rooms r
  where r.id = v_companion.room_id;
  if v_room_status is distinct from 'open' then
    raise exception 'room is closed' using errcode = 'P0001';
  end if;

  if p_expected_revision is null or p_expected_revision <= 0
    or p_format_version is null or p_format_version <= 0
    or p_campaign_data is null or jsonb_typeof(p_campaign_data) is distinct from 'object' then
    raise exception 'invalid campaign companion update' using errcode = '22023';
  end if;
  if jsonb_typeof(p_campaign_data->'id') is distinct from 'string'
    or p_campaign_data->>'id' is distinct from v_companion.source_local_id then
    raise exception 'campaign ficha identity cannot be changed' using errcode = '22023';
  end if;
  if v_companion.revision <> p_expected_revision then
    return jsonb_build_object(
      'status', 'conflict', 'companion_id', v_companion.id,
      'revision', v_companion.revision, 'campaign_data', v_companion.campaign_data
    );
  end if;

  update public.room_companions c
  set campaign_data = p_campaign_data,
      format_version = p_format_version,
      revision = c.revision + 1,
      updated_at = now()
  where c.id = v_companion.id
  returning c.revision into v_new_revision;

  return jsonb_build_object(
    'status', 'saved', 'companion_id', v_companion.id,
    'revision', v_new_revision
  );
end
$function$;

revoke all on function public.save_room_companion(uuid, bigint, integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_room_companion(uuid, bigint, integer, jsonb) to authenticated;
