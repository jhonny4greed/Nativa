-- First encounter increment: reserve campaign-specific companions while an
-- encounter is active. This does not implement combat rules or outcomes.

create unique index room_companions_room_id_id_player_id_uidx
  on public.room_companions (room_id, id, player_id);

create table public.room_encounters (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  finished_by uuid references auth.users (id) on delete restrict,
  finish_reason text check (finish_reason in ('completed', 'cancelled', 'room_closed')),
  check (
    (status = 'active' and finished_at is null and finished_by is null and finish_reason is null)
    or
    (status <> 'active' and finished_at is not null and finish_reason is not null)
  ),
  unique (room_id, id)
);
create index room_encounters_room_started_idx
  on public.room_encounters (room_id, started_at desc);

create table public.room_encounter_participants (
  encounter_id uuid not null,
  room_id uuid not null,
  player_id uuid not null references auth.users (id) on delete restrict,
  companion_id uuid not null,
  joined_at timestamptz not null default now(),
  released_at timestamptz,
  primary key (encounter_id, companion_id),
  foreign key (room_id, encounter_id)
    references public.room_encounters (room_id, id) on delete cascade,
  foreign key (room_id, companion_id, player_id)
    references public.room_companions (room_id, id, player_id) on delete restrict
);
create index room_encounter_participants_encounter_idx
  on public.room_encounter_participants (encounter_id);
create unique index room_encounter_one_active_per_companion_idx
  on public.room_encounter_participants (room_id, companion_id)
  where released_at is null;

alter table public.room_encounters enable row level security;
alter table public.room_encounter_participants enable row level security;
revoke all on table public.room_encounters, public.room_encounter_participants
  from public, anon, authenticated;
grant select on table public.room_encounters, public.room_encounter_participants to authenticated;

create policy room_encounters_select_members on public.room_encounters
  for select to authenticated
  using (nativa_private.is_room_member(room_id));
create policy room_encounter_participants_select_members on public.room_encounter_participants
  for select to authenticated
  using (nativa_private.is_room_member(room_id));

create or replace function public.start_room_encounter(
  p_room_id uuid,
  p_companion_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_member_role text;
  v_room_status text;
  v_expected_count integer;
  v_locked_count integer;
  v_encounter_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_room_id is null or p_companion_ids is null
    or cardinality(p_companion_ids) = 0
    or array_position(p_companion_ids, null) is not null then
    raise exception 'invalid encounter participants' using errcode = '22023';
  end if;
  if cardinality(p_companion_ids) <> (select count(distinct companion_id) from unnest(p_companion_ids) as ids(companion_id)) then
    raise exception 'duplicate encounter companion' using errcode = '22023';
  end if;

  -- Shared room/member locks serialize closing or kicking against a start,
  -- while allowing independent encounter starts in the same room to proceed.
  select r.status, rm.role into v_room_status, v_member_role
  from public.rooms r
  join public.room_members rm on rm.room_id = r.id and rm.user_id = v_user_id
  where r.id = p_room_id
  for share of r, rm;
  if not found then
    raise exception 'room encounter access denied' using errcode = '42501';
  end if;
  if v_room_status <> 'open' then
    raise exception 'room is closed' using errcode = 'P0001';
  end if;
  -- Until PvP acceptance is implemented, players may reserve only their own
  -- single campaign instance. A master may reserve multiple authorized rows.
  if v_member_role <> 'master' and cardinality(p_companion_ids) <> 1 then
    raise exception 'room encounter access denied' using errcode = '42501';
  end if;

  -- Stable lock order avoids deadlocks when a master reserves multiple
  -- instances. The companion row lock serializes concurrent starts for the
  -- same instance; the partial unique index below remains the final guard.
  perform c.id
  from public.room_companions c
  where c.room_id = p_room_id
    and c.id = any (p_companion_ids)
    and c.is_active
    and (v_member_role = 'master' or c.player_id = v_user_id)
  order by c.id
  for update;
  get diagnostics v_locked_count = row_count;
  v_expected_count := cardinality(p_companion_ids);
  if v_locked_count <> v_expected_count then
    raise exception 'room encounter access denied' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.room_encounter_participants ep
    where ep.room_id = p_room_id
      and ep.companion_id = any (p_companion_ids)
      and ep.released_at is null
  ) then
    return jsonb_build_object('status', 'companion_busy');
  end if;

  begin
    insert into public.room_encounters (room_id, created_by)
    values (p_room_id, v_user_id)
    returning id into v_encounter_id;

    insert into public.room_encounter_participants (encounter_id, room_id, player_id, companion_id)
    select v_encounter_id, c.room_id, c.player_id, c.id
    from public.room_companions c
    where c.room_id = p_room_id and c.id = any (p_companion_ids) and c.is_active;
  exception when unique_violation then
    return jsonb_build_object('status', 'companion_busy');
  end;

  return jsonb_build_object(
    'status', 'started',
    'encounter_id', v_encounter_id,
    'participant_count', v_expected_count
  );
end
$function$;

create or replace function public.finish_room_encounter(
  p_encounter_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_encounter public.room_encounters%rowtype;
  v_is_master boolean;
  v_is_participant boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_status not in ('completed', 'cancelled') then
    raise exception 'invalid encounter finish status' using errcode = '22023';
  end if;
  select e.* into v_encounter
  from public.room_encounters e
  where e.id = p_encounter_id and nativa_private.is_room_member(e.room_id)
  for update;
  if not found then
    raise exception 'room encounter access denied' using errcode = '42501';
  end if;
  v_is_master := nativa_private.is_room_master(v_encounter.room_id);
  select exists (
    select 1 from public.room_encounter_participants ep
    where ep.encounter_id = v_encounter.id and ep.player_id = v_user_id
  ) into v_is_participant;
  if (p_status = 'cancelled' and not v_is_master)
    or (p_status = 'completed' and not (v_is_master or v_is_participant)) then
    raise exception 'room encounter finish denied' using errcode = '42501';
  end if;
  if v_encounter.status <> 'active' then
    return jsonb_build_object('status', v_encounter.status, 'encounter_id', v_encounter.id);
  end if;

  update public.room_encounters
  set status = p_status,
      finished_at = now(),
      finished_by = v_user_id,
      finish_reason = p_status
  where id = v_encounter.id;
  update public.room_encounter_participants
  set released_at = now()
  where encounter_id = v_encounter.id and released_at is null;

  return jsonb_build_object('status', p_status, 'encounter_id', v_encounter.id);
end
$function$;

create or replace function nativa_private.cancel_active_encounters_on_room_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status = 'open' and new.status = 'closed' then
    update public.room_encounters
    set status = 'cancelled',
        finished_at = now(),
        finished_by = auth.uid(),
        finish_reason = 'room_closed'
    where room_id = new.id and status = 'active';
    update public.room_encounter_participants
    set released_at = now()
    where room_id = new.id and released_at is null;
  end if;
  return new;
end
$function$;
create trigger rooms_cancel_active_encounters
  after update of status on public.rooms
  for each row execute function nativa_private.cancel_active_encounters_on_room_close();

revoke all on function public.start_room_encounter(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.start_room_encounter(uuid, uuid[]) to authenticated;
revoke all on function public.finish_room_encounter(uuid, text) from public, anon, authenticated;
grant execute on function public.finish_room_encounter(uuid, text) to authenticated;
revoke all on function nativa_private.cancel_active_encounters_on_room_close() from public, anon, authenticated;
