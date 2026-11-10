-- Persistent encounter requests and daily hunt allowance for shared campaigns.
alter table public.room_encounters
  add column kind text not null default 'hunt' check (kind in ('hunt','pvp')),
  add column turn integer not null default 1 check (turn > 0),
  add column revision bigint not null default 1,
  add column state jsonb,
  add column winner_id uuid references auth.users(id) on delete set null,
  add column result jsonb not null default '{}'::jsonb;

create table public.room_encounter_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  kind text not null check (kind in ('extra_hunt','pvp')),
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid references auth.users(id) on delete cascade,
  requester_companion_id uuid not null,
  target_companion_id uuid,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  encounter_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (room_id, requester_companion_id, requester_id)
    references public.room_companions(room_id,id,player_id) on delete cascade,
  foreign key (room_id, target_companion_id, target_id)
    references public.room_companions(room_id,id,player_id) on delete cascade,
  constraint room_encounter_request_encounter_fk foreign key (room_id, encounter_id)
    references public.room_encounters(room_id,id) on delete cascade
);
create index room_encounter_requests_inbox_idx
  on public.room_encounter_requests(room_id,status,created_at desc);
create unique index room_encounter_one_pending_pvp_target_idx
  on public.room_encounter_requests(room_id,target_id)
  where kind='pvp' and status='pending';
create unique index room_encounter_one_pending_extra_requester_idx
  on public.room_encounter_requests(room_id,requester_id)
  where kind='extra_hunt' and status='pending';

create table public.room_hunt_daily_usage (
  player_id uuid not null references auth.users(id) on delete cascade,
  campaign_day date not null,
  hunts_started integer not null default 0 check (hunts_started between 0 and 3),
  primary key(player_id,campaign_day)
);
create table public.room_encounter_choices (
  encounter_id uuid not null references public.room_encounters(id) on delete cascade,
  turn integer not null,
  player_id uuid not null references auth.users(id) on delete cascade,
  choice jsonb not null,
  created_at timestamptz not null default now(),
  primary key(encounter_id,turn,player_id)
);
alter table public.room_encounter_choices enable row level security;
revoke all on public.room_encounter_choices from public,anon,authenticated;
alter table public.room_encounter_requests enable row level security;
alter table public.room_hunt_daily_usage enable row level security;
revoke all on public.room_encounter_requests,public.room_hunt_daily_usage from public,anon,authenticated;
grant select on public.room_encounter_requests to authenticated;
create policy room_encounter_requests_select_member on public.room_encounter_requests
  for select to authenticated using(nativa_private.is_room_member(room_id));

create or replace function public.room_game_action(p_action text,p_room_id uuid,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid(); r public.room_encounter_requests; c public.room_companions;
  target_c public.room_companions; eid uuid; rid uuid; used integer; is_master boolean;
begin
  if u is null then raise exception 'authentication required' using errcode='42501'; end if;
  if octet_length(coalesce(p_payload,'{}'::jsonb)::text)>4096 then raise exception 'request too large'; end if;
  if not nativa_private.is_room_member(p_room_id) then raise exception 'room member required' using errcode='42501'; end if;
  if not exists(select 1 from public.rooms where id=p_room_id and status='open') then raise exception 'room is closed'; end if;
  is_master:=nativa_private.is_room_master(p_room_id);

  if p_action='start_hunt' then
    select * into c from public.room_companions where room_id=p_room_id and id=(p_payload->>'companionId')::uuid and player_id=u and is_active for update;
    if not found then raise exception 'active campaign companion required' using errcode='42501'; end if;
    if exists(select 1 from public.room_encounter_participants where room_id=p_room_id and companion_id=c.id and released_at is null) then raise exception 'companion is busy in another encounter'; end if;
    insert into public.room_hunt_daily_usage(player_id,campaign_day,hunts_started)
      values(u,(now() at time zone 'America/Sao_Paulo')::date,0) on conflict do nothing;
    select hunts_started into used from public.room_hunt_daily_usage where player_id=u and campaign_day=(now() at time zone 'America/Sao_Paulo')::date for update;
    if used>=3 then
      select id into rid from public.room_encounter_requests where room_id=p_room_id and requester_id=u and kind='extra_hunt' and status='pending';
      if rid is null then
        insert into public.room_encounter_requests(room_id,kind,requester_id,requester_companion_id)
          values(p_room_id,'extra_hunt',u,c.id) returning id into rid;
      end if;
      return jsonb_build_object('status','approval_required','request_id',rid,'free_hunts_remaining',0);
    end if;
    update public.room_hunt_daily_usage set hunts_started=used+1 where player_id=u and campaign_day=(now() at time zone 'America/Sao_Paulo')::date;
    insert into public.room_encounters(room_id,created_by,kind) values(p_room_id,u,'hunt') returning id into eid;
    insert into public.room_encounter_participants(encounter_id,room_id,player_id,companion_id) values(eid,p_room_id,u,c.id);
    return jsonb_build_object('status','started','encounter_id',eid,'free_hunts_remaining',2-used);
  elsif p_action='request_pvp' then
    select * into c from public.room_companions where room_id=p_room_id and id=(p_payload->>'companionId')::uuid and player_id=u and is_active;
    if not found then raise exception 'active campaign companion required'; end if;
    select * into target_c from public.room_companions where room_id=p_room_id and player_id=(p_payload->>'targetId')::uuid and is_active;
    if not found or target_c.player_id=u then raise exception 'PvP target has no active companion'; end if;
    if exists(select 1 from public.room_encounter_participants where room_id=p_room_id and companion_id in(c.id,target_c.id) and released_at is null) then raise exception 'a companion is busy in another encounter'; end if;
    insert into public.room_encounter_requests(room_id,kind,requester_id,target_id,requester_companion_id,target_companion_id)
      values(p_room_id,'pvp',u,target_c.player_id,c.id,target_c.id) returning id into rid;
    return jsonb_build_object('status','pending_acceptance','request_id',rid);
  elsif p_action in ('accept','decline') then
    select * into r from public.room_encounter_requests where id=(p_payload->>'requestId')::uuid and room_id=p_room_id for update;
    if not found or r.status<>'pending' then raise exception 'request is no longer pending'; end if;
    if r.kind='pvp' and r.target_id<>u then raise exception 'only challenged player can respond' using errcode='42501'; end if;
    if r.kind='extra_hunt' and not is_master then raise exception 'room master required' using errcode='42501'; end if;
    if p_action='decline' then
      update public.room_encounter_requests set status='declined',resolved_at=now() where id=r.id;
      return jsonb_build_object('status','declined','request_id',r.id);
    end if;
    if exists(select 1 from public.room_encounter_participants where room_id=p_room_id and companion_id in (r.requester_companion_id,r.target_companion_id) and released_at is null) then raise exception 'a companion is busy in another encounter'; end if;
    if r.kind='extra_hunt' then
      insert into public.room_encounters(room_id,created_by,kind) values(p_room_id,r.requester_id,'hunt') returning id into eid;
      insert into public.room_encounter_participants(encounter_id,room_id,player_id,companion_id) values(eid,p_room_id,r.requester_id,r.requester_companion_id);
    else
      insert into public.room_encounters(room_id,created_by,kind) values(p_room_id,r.requester_id,'pvp') returning id into eid;
      insert into public.room_encounter_participants(encounter_id,room_id,player_id,companion_id)
        values(eid,p_room_id,r.requester_id,r.requester_companion_id),(eid,p_room_id,r.target_id,r.target_companion_id);
    end if;
    update public.room_encounter_requests set status='accepted',encounter_id=eid,resolved_at=now() where id=r.id;
    return jsonb_build_object('status','started','encounter_id',eid);
  end if;
  raise exception 'unknown room game action';
end $$;
revoke all on function public.room_game_action(text,uuid,jsonb) from public,anon;
grant execute on function public.room_game_action(text,uuid,jsonb) to authenticated;
revoke all on function public.start_room_encounter(uuid,uuid[]),public.finish_room_encounter(uuid,text) from authenticated;

create or replace function public.room_game_context(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
  if u is null or not nativa_private.is_room_member(p_room_id) then raise exception 'room member required' using errcode='42501'; end if;
  return jsonb_build_object(
    'free_hunts_remaining',greatest(0,3-coalesce((select hunts_started from public.room_hunt_daily_usage where player_id=u and campaign_day=(now() at time zone 'America/Sao_Paulo')::date),0)),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'kind',q.kind,'requester_id',q.requester_id,'target_id',q.target_id,'status',q.status,'created_at',q.created_at,'requester_name',p.display_name)) from public.room_encounter_requests q join public.profiles p on p.id=q.requester_id join public.rooms room on room.id=q.room_id and room.status='open' where q.room_id=p_room_id and q.status='pending' and (q.target_id=u or (q.kind='extra_hunt' and nativa_private.is_room_master(p_room_id)))),'[]'::jsonb),
    'encounters',coalesce((select jsonb_agg(x.item order by x.started_at desc) from (select e.started_at,jsonb_build_object('id',e.id,'kind',e.kind,'status',e.status,'turn',e.turn,'state',case when nativa_private.is_room_master(p_room_id) or exists(select 1 from public.room_encounter_participants ep where ep.encounter_id=e.id and ep.player_id=u) then e.state else null end,'result',e.result,'winner_id',e.winner_id,'created_by',e.created_by,'own_choice',(select ch.choice from public.room_encounter_choices ch where ch.encounter_id=e.id and ch.turn=e.turn and ch.player_id=u),'participants',(select jsonb_agg(jsonb_build_object('player_id',ep.player_id,'companion_id',ep.companion_id,'display_name',pr.display_name,'companion_name',rc.campaign_data->>'name') order by ep.joined_at) from public.room_encounter_participants ep join public.profiles pr on pr.id=ep.player_id join public.room_companions rc on rc.id=ep.companion_id where ep.encounter_id=e.id)) item from public.room_encounters e where e.room_id=p_room_id order by e.started_at desc limit 10) x),'[]'::jsonb)
  );
end $$;
revoke all on function public.room_game_context(uuid) from public,anon;
grant execute on function public.room_game_context(uuid) to authenticated;

create or replace function public.room_game_submit_choice(p_encounter_id uuid,p_turn integer,p_choice jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e public.room_encounters; previous jsonb;
begin
  select * into e from public.room_encounters where id=p_encounter_id and nativa_private.is_room_member(room_id) for update;
  if not found or e.status<>'active' or not exists(select 1 from public.room_encounter_participants where encounter_id=e.id and player_id=u) then raise exception 'active encounter participant required' using errcode='42501'; end if;
  if e.turn<>p_turn then raise exception 'turn changed; refresh the encounter'; end if;
  if jsonb_typeof(p_choice)<>'object' or octet_length(p_choice::text)>512 then raise exception 'invalid combat action'; end if;
  select choice into previous from public.room_encounter_choices where encounter_id=e.id and turn=p_turn and player_id=u;
  if previous is not null and previous<>p_choice then raise exception 'action already confirmed this turn'; end if;
  insert into public.room_encounter_choices(encounter_id,turn,player_id,choice) values(e.id,p_turn,u,p_choice) on conflict do nothing;
  return jsonb_build_object('status','submitted','ready',e.kind='hunt' or (select count(*)=2 from public.room_encounter_choices where encounter_id=e.id and turn=e.turn));
end $$;
revoke all on function public.room_game_submit_choice(uuid,integer,jsonb) from public,anon;
grant execute on function public.room_game_submit_choice(uuid,integer,jsonb) to authenticated;

create or replace function public.room_game_server_context(p_encounter_id uuid)
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('encounter',to_jsonb(e),'participants',coalesce((select jsonb_agg(jsonb_build_object('player_id',ep.player_id,'companion_id',ep.companion_id,'campaign_data',rc.campaign_data) order by ep.joined_at) from public.room_encounter_participants ep join public.room_companions rc on rc.id=ep.companion_id where ep.encounter_id=e.id),'[]'::jsonb),'choices',coalesce((select jsonb_agg(to_jsonb(c)) from public.room_encounter_choices c where c.encounter_id=e.id and c.turn=e.turn),'[]'::jsonb)) from public.room_encounters e where e.id=p_encounter_id;
$$;
revoke all on function public.room_game_server_context(uuid) from public,anon,authenticated;
grant execute on function public.room_game_server_context(uuid) to service_role;

create or replace function public.room_game_server_commit(p_encounter_id uuid,p_revision bigint,p_state jsonb,p_turn integer,p_status text,p_winner uuid,p_result jsonb,p_reward jsonb default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer; reward_id uuid; reward_data jsonb; begin
  if p_status not in ('active','completed','cancelled') or p_turn<1 then raise exception 'invalid encounter result'; end if;
  update public.room_encounters set state=p_state,turn=p_turn,status=p_status,winner_id=p_winner,result=coalesce(p_result,'{}'::jsonb),revision=revision+1,
    finished_at=case when p_status='active' then null else now() end,finish_reason=case when p_status='completed' then 'completed' when p_status='cancelled' then 'cancelled' else null end
    where id=p_encounter_id and revision=p_revision and status='active';
  get diagnostics changed=row_count;
  if changed<>1 then return false; end if;
  if p_reward is not null then
    for reward_id,reward_data in select key::uuid,value from jsonb_each(p_reward) loop
      update public.room_companions set campaign_data=reward_data,revision=revision+1,updated_at=now()
      where id=reward_id and room_id=(select room_id from public.room_encounters where id=p_encounter_id)
        and exists(select 1 from public.room_encounter_participants where encounter_id=p_encounter_id and companion_id=reward_id);
      if not found then raise exception 'campaign reward target invalid'; end if;
    end loop;
  end if;
  if changed=1 and p_status<>'active' then update public.room_encounter_participants set released_at=now() where encounter_id=p_encounter_id and released_at is null; end if;
  return changed=1;
end $$;
revoke all on function public.room_game_server_commit(uuid,bigint,jsonb,integer,text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.room_game_server_commit(uuid,bigint,jsonb,integer,text,uuid,jsonb,jsonb) to service_role;
