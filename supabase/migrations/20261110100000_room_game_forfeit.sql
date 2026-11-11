-- Let a participant end their active campaign encounter from the shared arena.
-- PvP awards the win to the other participant; hunts end without rewards.
create or replace function public.room_game_forfeit(p_encounter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  e public.room_encounters;
  opponent uuid;
  next_status text;
  next_reason text;
  result_data jsonb;
begin
  if u is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into e
  from public.room_encounters
  where id = p_encounter_id
    and nativa_private.is_room_member(room_id)
  for update;

  if not found or e.status <> 'active'
     or not exists (
       select 1 from public.room_encounter_participants
       where encounter_id = e.id and player_id = u
     ) then
    raise exception 'active encounter participant required' using errcode = '42501';
  end if;

  if e.kind = 'pvp' then
    select player_id into opponent
    from public.room_encounter_participants
    where encounter_id = e.id and player_id <> u
    order by joined_at
    limit 1;
    if opponent is null then
      raise exception 'opponent unavailable';
    end if;
    next_status := 'completed';
    next_reason := 'completed';
    result_data := jsonb_build_object('forfeit', true, 'loserId', u, 'winnerId', opponent);
  else
    next_status := 'cancelled';
    next_reason := 'cancelled';
    result_data := jsonb_build_object('forfeit', true, 'loserId', u);
  end if;

  update public.room_encounters
  set status = next_status,
      finished_at = now(),
      finished_by = u,
      finish_reason = next_reason,
      winner_id = opponent,
      result = result_data,
      revision = revision + 1
  where id = e.id and status = 'active';

  if not found then
    raise exception 'encounter already finished';
  end if;

  update public.room_encounter_participants
  set released_at = now()
  where encounter_id = e.id and released_at is null;

  return jsonb_build_object('status', next_status, 'winner_id', opponent, 'result', result_data);
end;
$$;

revoke all on function public.room_game_forfeit(uuid) from public, anon;
grant execute on function public.room_game_forfeit(uuid) to authenticated;
