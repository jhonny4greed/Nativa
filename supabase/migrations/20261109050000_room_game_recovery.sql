-- Keep approved requests bound to active campaign participants, and let the
-- room master safely release a stalled encounter.
create or replace function nativa_private.guard_room_game_request_accept()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status<>'pending' or new.status<>'accepted' then return new; end if;
  if not exists(select 1 from public.rooms where id=new.room_id and status='open')
    or not exists(select 1 from public.room_members where room_id=new.room_id and user_id=new.requester_id)
    or not exists(select 1 from public.room_companions where id=new.requester_companion_id and room_id=new.room_id and player_id=new.requester_id and is_active) then
    raise exception 'requester is no longer active in this campaign';
  end if;
  if new.kind='pvp' and (not exists(select 1 from public.room_members where room_id=new.room_id and user_id=new.target_id)
    or not exists(select 1 from public.room_companions where id=new.target_companion_id and room_id=new.room_id and player_id=new.target_id and is_active)) then
    raise exception 'challenged player is no longer active in this campaign';
  end if;
  if exists(select 1 from public.room_encounter_participants where room_id=new.room_id and companion_id in(new.requester_companion_id,new.target_companion_id) and released_at is null) then
    raise exception 'a companion is busy in another encounter';
  end if;
  return new;
end $$;
create trigger room_game_request_accept_guard
  before update of status on public.room_encounter_requests
  for each row execute function nativa_private.guard_room_game_request_accept();
revoke all on function nativa_private.guard_room_game_request_accept() from public,anon,authenticated;

create or replace function public.room_game_cancel(p_encounter_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e public.room_encounters;
begin
  select * into e from public.room_encounters where id=p_encounter_id and nativa_private.is_room_member(room_id) for update;
  if not found or not nativa_private.is_room_master(e.room_id) then raise exception 'room master required' using errcode='42501'; end if;
  if e.status='active' then
    update public.room_encounters set status='cancelled',finished_at=now(),finished_by=u,finish_reason='cancelled',revision=revision+1 where id=e.id;
    update public.room_encounter_participants set released_at=now() where encounter_id=e.id and released_at is null;
  end if;
  return jsonb_build_object('status',(select status from public.room_encounters where id=e.id),'encounter_id',e.id);
end $$;
revoke all on function public.room_game_cancel(uuid) from public,anon;
grant execute on function public.room_game_cancel(uuid) to authenticated;
