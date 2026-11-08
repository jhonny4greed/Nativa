-- Encounter history belongs to a room/campaign. Deleting the room or one of
-- its otherwise-inaccessible companion rows must cascade reservations safely.
alter table public.room_encounter_participants
  drop constraint room_encounter_participants_room_id_companion_id_player_id_fkey;
alter table public.room_encounter_participants
  add constraint room_encounter_participants_room_id_companion_id_player_id_fkey
  foreign key (room_id, companion_id, player_id)
  references public.room_companions (room_id, id, player_id)
  on delete cascade;
