-- Friendly online duels. All choices and canonical combat state are server-owned.
create table public.arena_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now()
);
create table public.arena_matches (
  id uuid primary key default extensions.gen_random_uuid(),
  mode text not null check(mode in ('private','quick','challenge')),
  code text not null unique default encode(extensions.gen_random_bytes(12),'hex'),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete cascade,
  target_id uuid references auth.users(id) on delete cascade,
  host_ficha jsonb not null,
  guest_ficha jsonb,
  status text not null default 'waiting' check(status in ('waiting','active','completed','cancelled')),
  biome text not null default 'Floresta e Mata',
  turn integer not null default 1 check(turn>0),
  revision bigint not null default 1,
  state jsonb,
  winner_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '15 minutes',
  check(guest_id is null or guest_id<>host_id),
  check(target_id is null or target_id<>host_id)
);
create index arena_matches_open_idx on public.arena_matches(status,created_at);
create table public.arena_choices (
  match_id uuid not null references public.arena_matches(id) on delete cascade,
  turn integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  choice jsonb not null,
  created_at timestamptz not null default now(),
  primary key(match_id,turn,user_id)
);
alter table public.arena_presence enable row level security;
alter table public.arena_matches enable row level security;
alter table public.arena_choices enable row level security;
revoke all on public.arena_presence,public.arena_matches,public.arena_choices from public,anon,authenticated;
grant all on public.arena_presence,public.arena_matches,public.arena_choices to service_role;

create or replace function nativa_private.arena_ficha(p_id uuid,p_owner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb; attribute text;
begin
  select data into d from public.nativas where id=p_id and owner_id=p_owner and deleted_at is null;
  if d is null then raise exception 'Nativa sincronizada não encontrada para esta conta' using errcode='42501'; end if;
  if jsonb_typeof(d->'attrs') is distinct from 'object' or jsonb_typeof(d->'techniques') is distinct from 'array'
    or jsonb_typeof(d->'name') is distinct from 'string' then raise exception 'Ficha de combate inválida'; end if;
  if jsonb_array_length(d->'techniques')>6 or length(btrim(d->>'name')) not between 1 and 80 then raise exception 'Ficha de combate inválida'; end if;
  foreach attribute in array array['ATQ','POT','DEF','RES','AGI','HP','MP'] loop
    if jsonb_typeof(d->'attrs'->attribute) is distinct from 'number' then raise exception 'Atributo inválido'; end if;
    if (d->'attrs'->>attribute)::numeric not between 1 and 99 or (d->'attrs'->>attribute)::numeric<>trunc((d->'attrs'->>attribute)::numeric) then raise exception 'Atributo inválido'; end if;
  end loop;
  if jsonb_typeof(coalesce(d->'essencias','[]'::jsonb))<>'array' or jsonb_typeof(coalesce(d->'afinidadesEssencia','[]'::jsonb))<>'array' then raise exception 'Essências inválidas'; end if;
  -- Never share player, photo blobs, account/sync metadata or progression history.
  return jsonb_build_object('id',d->'id','name',d->'name','species',d->'species',
    'lineage',d->'lineage','lineageName',d->'lineageName','groupBio',d->'groupBio',
    'affinity',d->'affinity','bioma',d->'bioma','archetype',d->'archetype',
    'attrs',d->'attrs','techniques',d->'techniques','tracos',coalesce(d->'tracos','[]'::jsonb),
    'essencias',coalesce(d->'essencias','[]'::jsonb),'afinidadesEssencia',coalesce(d->'afinidadesEssencia','[]'::jsonb),
    'nivel',coalesce(d->'nivel','1'::jsonb));
end;
$$;
revoke all on function nativa_private.arena_ficha(uuid,uuid) from public,anon,authenticated;

create or replace function nativa_private.arena_view(p_id uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.arena_matches; own_choice jsonb;
begin
  select * into m from public.arena_matches where id=p_id;
  if not found or (p_user<>m.host_id and p_user is distinct from m.guest_id and p_user is distinct from m.target_id) then
    raise exception 'Duelo indisponível para esta conta' using errcode='42501';
  end if;
  select choice into own_choice from public.arena_choices where match_id=m.id and turn=m.turn and user_id=p_user;
  return jsonb_build_object('id',m.id,'mode',m.mode,'status',m.status,'turn',m.turn,'revision',m.revision,
    'selfIndex',case when p_user=m.host_id then 0 else 1 end,
    'hostName',(select display_name from public.profiles where id=m.host_id),
    'guestName',(select display_name from public.profiles where id=m.guest_id),
    'hostFicha',m.host_ficha,'guestFicha',m.guest_ficha,'biome',m.biome,'state',m.state,
    'ownChoice',own_choice,'ownConfirmed',own_choice is not null,
    'opponentConfirmed',exists(select 1 from public.arena_choices where match_id=m.id and turn=m.turn and user_id<>p_user),
    'code',case when p_user=m.host_id and m.mode='private' then m.code else null end,
    'winnerIndex',case when m.winner_id=m.host_id then 0 when m.winner_id=m.guest_id then 1 else null end,
    'reason',m.reason,'expiresAt',m.expires_at);
end;
$$;
revoke all on function nativa_private.arena_view(uuid,uuid) from public,anon,authenticated;

create or replace function public.arena_lobby(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); m public.arena_matches; ficha jsonb; mid uuid; target uuid; list jsonb; incoming jsonb;
begin
  if u is null then raise exception 'Entre na sua conta para jogar online' using errcode='42501'; end if;
  if octet_length(p_payload::text)>4096 then raise exception 'Pedido muito grande'; end if;
  if p_action='heartbeat' then
    insert into public.arena_presence(user_id) values(u) on conflict(user_id) do update set seen_at=now();
    return jsonb_build_object('online',true);
  elsif p_action='offline' then
    delete from public.arena_presence where user_id=u;
    update public.arena_matches set status='cancelled',reason='left_lobby',revision=revision+1 where host_id=u and status='waiting';
    return jsonb_build_object('online',false);
  elsif p_action='lobby' then
    select coalesce(jsonb_agg(jsonb_build_object('id',p.user_id,'name',r.display_name,
      'busy',exists(select 1 from public.arena_matches a where a.status='active' and p.user_id in(a.host_id,a.guest_id)))),'[]'::jsonb)
      into list from public.arena_presence p join public.profiles r on r.id=p.user_id
      where p.seen_at>now()-interval '70 seconds' and p.user_id<>u;
    select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',r.display_name,'nativa',a.host_ficha->>'name')),'[]'::jsonb)
      into incoming from public.arena_matches a join public.profiles r on r.id=a.host_id
      where a.target_id=u and a.status='waiting' and a.expires_at>now();
    select id into mid from public.arena_matches where status in('waiting','active') and u in(host_id,guest_id)
      and (status='active' or expires_at>now()) order by created_at desc limit 1;
    return jsonb_build_object('players',list,'incoming',incoming,'current',case when mid is not null then nativa_private.arena_view(mid,u) else null end);
  elsif p_action='snapshot' then
    mid:=(p_payload->>'matchId')::uuid;
    -- An abandoned duel closes without changing either source ficha.
    update public.arena_matches set status='cancelled',reason='timeout',revision=revision+1
      where id=mid and status='active' and updated_at<now()-interval '5 minutes' and u in(host_id,guest_id);
    return nativa_private.arena_view(mid,u);
  end if;
  if p_action not in('private','quick','challenge','join','accept','decline','cancel','forfeit') then raise exception 'Ação desconhecida'; end if;
  -- Serializes matchmaking and cross-column participant checks, not polling.
  perform pg_advisory_xact_lock(hashtext('nativa-online-matchmaking'));
  update public.arena_matches set status='cancelled',reason='expired',revision=revision+1 where status='waiting' and expires_at<=now();
  if p_action in('decline','cancel','forfeit') then
    select * into m from public.arena_matches where id=(p_payload->>'matchId')::uuid for update;
    if not found then raise exception 'Duelo não encontrado'; end if;
    if p_action='decline' and m.target_id=u and m.status='waiting' then
      update public.arena_matches set status='cancelled',reason='declined',revision=revision+1 where id=m.id;
    elsif p_action='cancel' and m.host_id=u and m.status='waiting' then
      update public.arena_matches set status='cancelled',reason='cancelled',revision=revision+1 where id=m.id;
    elsif p_action='forfeit' and u in(m.host_id,m.guest_id) and m.status='active' then
      update public.arena_matches set status='completed',reason='forfeit',winner_id=case when host_id=u then guest_id else host_id end,revision=revision+1 where id=m.id;
    else raise exception 'Ação não permitida' using errcode='42501'; end if;
    return nativa_private.arena_view(m.id,u);
  end if;
  if exists(select 1 from public.arena_matches where status in('waiting','active') and u in(host_id,guest_id)) then
    raise exception 'Encerre seu duelo ou sua busca atual antes de começar outro';
  end if;
  ficha:=nativa_private.arena_ficha((p_payload->>'nativaId')::uuid,u);
  if p_action in('join','accept') then
    select * into m from public.arena_matches where status='waiting' and expires_at>now() and host_id<>u
      and ((p_action='join' and mode='private' and code=p_payload->>'code')
        or (p_action='accept' and mode='challenge' and target_id=u and id=(p_payload->>'matchId')::uuid)) for update;
    if not found then raise exception 'Convite inválido, expirado ou já utilizado'; end if;
  elsif p_action='quick' then
    select * into m from public.arena_matches where mode='quick' and status='waiting' and expires_at>now() and host_id<>u
      and exists(select 1 from public.arena_presence where user_id=host_id and seen_at>now()-interval '70 seconds')
      order by created_at limit 1 for update;
  elsif p_action='challenge' then
    target:=(p_payload->>'userId')::uuid;
    if target=u or not exists(select 1 from public.arena_presence where user_id=target and seen_at>now()-interval '70 seconds')
      or exists(select 1 from public.arena_matches where status='active' and target in(host_id,guest_id)) then
      raise exception 'Este jogador não está disponível';
    end if;
  end if;
  if m.id is not null then
    update public.arena_matches set guest_id=u,guest_ficha=ficha,status='active',updated_at=now(),revision=revision+1 where id=m.id;
    mid:=m.id;
  else
    if coalesce(p_payload->>'biome','Floresta e Mata') not in('Floresta e Mata','Rios, Lagos e Pantanal','Caatinga e Cerrado','Costa, Restinga e Manguezal','Campos Sulinos e Pampa') then raise exception 'Bioma inválido'; end if;
    insert into public.arena_matches(mode,host_id,target_id,host_ficha,biome)
      values(p_action,u,target,ficha,coalesce(p_payload->>'biome','Floresta e Mata')) returning id into mid;
  end if;
  insert into public.arena_presence(user_id) values(u) on conflict(user_id) do update set seen_at=now();
  return nativa_private.arena_view(mid,u);
end;
$$;
revoke all on function public.arena_lobby(text,jsonb) from public,anon;
grant execute on function public.arena_lobby(text,jsonb) to authenticated;

-- Edge-only APIs: clients cannot submit choices or write combat outcomes directly.
create or replace function public.arena_server_context(p_match_id uuid)
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('match',to_jsonb(m)-'code','choices',coalesce((select jsonb_agg(to_jsonb(c)) from public.arena_choices c where c.match_id=m.id and c.turn=m.turn),'[]'::jsonb))
  from public.arena_matches m where m.id=p_match_id;
$$;
create or replace function public.arena_server_choice(p_match_id uuid,p_user uuid,p_turn integer,p_choice jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare m public.arena_matches; previous jsonb;
begin
  select * into m from public.arena_matches where id=p_match_id for update;
  if not found or p_user not in(m.host_id,m.guest_id) or m.guest_id is null or m.status<>'active' then raise exception 'Duelo indisponível' using errcode='42501'; end if;
  if m.turn<>p_turn then raise exception 'O turno mudou; atualize a arena'; end if;
  select choice into previous from public.arena_choices where match_id=m.id and turn=p_turn and user_id=p_user;
  if previous is not null then
    if previous<>p_choice then raise exception 'Ação já confirmada neste turno'; end if;
    return;
  end if;
  insert into public.arena_choices(match_id,turn,user_id,choice) values(m.id,p_turn,p_user,p_choice);
  update public.arena_matches set updated_at=now() where id=m.id;
end;
$$;
create or replace function public.arena_server_commit(p_match_id uuid,p_revision bigint,p_state jsonb,p_turn integer,p_ended boolean,p_winner uuid default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  update public.arena_matches set state=p_state,turn=p_turn,status=case when p_ended then 'completed' else 'active' end,
    winner_id=p_winner,revision=revision+1,updated_at=now(),reason=case when p_ended then 'victory' else null end
    where id=p_match_id and revision=p_revision and status='active';
  get diagnostics changed=row_count;
  return changed=1;
end;
$$;
revoke all on function public.arena_server_context(uuid),public.arena_server_choice(uuid,uuid,integer,jsonb),public.arena_server_commit(uuid,bigint,jsonb,integer,boolean,uuid) from public,anon,authenticated;
grant execute on function public.arena_server_context(uuid),public.arena_server_choice(uuid,uuid,integer,jsonb),public.arena_server_commit(uuid,bigint,jsonb,integer,boolean,uuid) to service_role;
