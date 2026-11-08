-- Campaign-scoped companion instances, privacy-safe reads and room admin.
-- The original public.nativas rows remain player-owned source fichas.

create table public.room_companions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete restrict,
  source_nativa_id uuid references public.nativas (id) on delete set null,
  source_local_id text not null check (char_length(source_local_id) between 1 and 160),
  format_version integer not null check (format_version > 0),
  revision bigint not null default 1 check (revision > 0),
  campaign_data jsonb not null check (
    jsonb_typeof(campaign_data) = 'object'
    and jsonb_typeof(campaign_data->'id') = 'string'
    and campaign_data->>'id' = source_local_id
  ),
  is_active boolean not null default true,
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,
  check ((is_active and retired_at is null) or (not is_active and retired_at is not null)),
  unique (room_id, player_id, source_local_id)
);

create unique index room_companions_one_active_per_player_room_idx
  on public.room_companions (room_id, player_id)
  where is_active;
create index room_companions_room_player_history_idx
  on public.room_companions (room_id, player_id, selected_at desc);
create index room_companions_source_nativa_idx
  on public.room_companions (source_nativa_id)
  where source_nativa_id is not null;

comment on table public.room_companions is
  'Campaign-local Nativa instances. campaign_data is an independent JSON snapshot; source_nativa_id/local_id identify the original ficha.';
comment on column public.room_companions.campaign_data is
  'Full campaign-specific ficha snapshot, including unknown legacy fields; changes here never write to public.nativas.';
comment on column public.room_nativas.visibility is
  'Legacy share setting retained for data compatibility. Companion privacy now follows room companion RPC/RLS rules.';

-- Preserve only unambiguous legacy choices. A single explicitly shared ficha
-- is migrated as the player's initial companion. If a player had several
-- shares in one room, retain every legacy row and leave the choice to them.
with legacy_counts as (
  select rn.room_id, rn.owner_id, count(*)::integer as share_count
  from public.room_nativas rn
  group by rn.room_id, rn.owner_id
)
insert into public.room_companions (
  room_id, player_id, source_nativa_id, source_local_id,
  format_version, campaign_data, is_active
)
select rn.room_id, rn.owner_id, n.id, n.local_id,
       n.format_version, n.data, true
from public.room_nativas rn
join legacy_counts lc on lc.room_id = rn.room_id and lc.owner_id = rn.owner_id
join public.nativas n on n.id = rn.nativa_id and n.owner_id = rn.owner_id
where lc.share_count = 1
  and n.deleted_at is null
on conflict (room_id, player_id, source_local_id) do nothing;

create or replace function nativa_private.can_view_shared_nativa(p_nativa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.nativas n
    join public.room_members owner_members on owner_members.user_id = n.owner_id
    join public.room_members viewer
      on viewer.room_id = owner_members.room_id
     and viewer.user_id = auth.uid()
     and viewer.role = 'master'
    where n.id = p_nativa_id
  );
$$;

create or replace function nativa_private.can_view_room_companion_full(
  p_room_id uuid,
  p_player_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    (auth.uid() = p_player_id and nativa_private.is_room_member(p_room_id))
    or nativa_private.is_room_master(p_room_id)
  );
$$;

alter table public.room_companions enable row level security;
revoke all on table public.room_companions from public, anon, authenticated;
grant select on table public.room_companions to authenticated;
create policy room_companions_select_owner_or_master on public.room_companions
for select to authenticated
using (nativa_private.can_view_room_companion_full(room_id, player_id));

-- The old share table is retained read-only for data compatibility. Its
-- visibility flag can no longer grant players full ficha JSON access.
drop policy if exists room_nativas_select_owner_master_or_visible_member on public.room_nativas;
drop policy if exists room_nativas_select_owner_or_master on public.room_nativas;
drop policy if exists room_nativas_update_owner_visibility on public.room_nativas;
drop policy if exists room_nativas_insert_owner_member on public.room_nativas;
drop policy if exists room_nativas_delete_owner on public.room_nativas;
create policy room_nativas_select_owner_or_master on public.room_nativas
for select to authenticated
using (owner_id = (select auth.uid()) or nativa_private.is_room_master(room_id));
revoke all on table public.room_nativas from public, anon, authenticated;
grant select on table public.room_nativas to authenticated;

-- Keep sensitive tables out of Postgres Changes; room details are read through
-- authorized RPCs and explicit refreshes. Abort rather than leave an ALL TABLES
-- publication that would bypass this guarantee.
do $migration$
declare
  v_all_tables boolean;
begin
  select p.puballtables into v_all_tables
  from pg_catalog.pg_publication p
  where p.pubname = 'supabase_realtime';
  if coalesce(v_all_tables, false) then
    raise exception 'supabase_realtime publishes all tables; exclude ficha and companion tables before applying this migration';
  end if;
  if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_companions') then
    execute 'alter publication supabase_realtime drop table public.room_companions';
  end if;
  if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nativas') then
    execute 'alter publication supabase_realtime drop table public.nativas';
  end if;
  if exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_nativas') then
    execute 'alter publication supabase_realtime drop table public.room_nativas';
  end if;
end
$migration$;

create or replace function public.choose_room_companion(
  p_room_id uuid,
  p_nativa_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_room_status text;
  v_local_id text;
  v_format_version integer;
  v_source_data jsonb;
  v_companion_id uuid;
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_room_id is null or p_nativa_id is null then
    raise exception 'room and ficha are required' using errcode = '22023';
  end if;

  select r.status into v_room_status
  from public.rooms r
  where r.id = p_room_id
  for update;
  if not found then
    raise exception 'room member required' using errcode = '42501';
  end if;
  if v_room_status <> 'open' then
    raise exception 'room is closed' using errcode = 'P0001';
  end if;

  perform 1 from public.room_members rm
  where rm.room_id = p_room_id and rm.user_id = v_user_id
  for update;
  if not found then
    raise exception 'room member required' using errcode = '42501';
  end if;

  select n.local_id, n.format_version, n.data
  into v_local_id, v_format_version, v_source_data
  from public.nativas n
  where n.id = p_nativa_id
    and n.owner_id = v_user_id
    and n.deleted_at is null
  for share;
  if not found then
    raise exception 'nativa owner required or ficha unavailable' using errcode = '42501';
  end if;

  select c.id, c.revision into v_companion_id, v_revision
  from public.room_companions c
  where c.room_id = p_room_id
    and c.player_id = v_user_id
    and c.source_local_id = v_local_id
    and c.is_active
  for update;
  if found then
    return jsonb_build_object('status', 'already_selected', 'companion_id', v_companion_id, 'revision', v_revision);
  end if;

  update public.room_companions c
  set is_active = false, retired_at = now(), updated_at = now()
  where c.room_id = p_room_id and c.player_id = v_user_id and c.is_active;

  select c.id into v_companion_id
  from public.room_companions c
  where c.room_id = p_room_id
    and c.player_id = v_user_id
    and c.source_local_id = v_local_id
  for update;

  if found then
    update public.room_companions c
    set source_nativa_id = p_nativa_id,
        is_active = true,
        retired_at = null,
        updated_at = now()
    where c.id = v_companion_id
    returning c.revision into v_revision;
  else
    insert into public.room_companions (
      room_id, player_id, source_nativa_id, source_local_id,
      format_version, campaign_data, is_active
    ) values (
      p_room_id, v_user_id, p_nativa_id, v_local_id,
      v_format_version, v_source_data, true
    ) returning id, revision into v_companion_id, v_revision;
  end if;

  return jsonb_build_object('status', 'selected', 'companion_id', v_companion_id, 'revision', v_revision);
end
$function$;

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
  if p_companion_id is null or p_expected_revision is null or p_expected_revision <= 0
    or p_format_version is null or p_format_version <= 0
    or p_campaign_data is null or jsonb_typeof(p_campaign_data) <> 'object' then
    raise exception 'invalid campaign companion update' using errcode = '22023';
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
  if jsonb_typeof(p_campaign_data->'id') is distinct from 'string'
    or p_campaign_data->>'id' is distinct from v_companion.source_local_id then
    raise exception 'campaign ficha identity cannot be changed' using errcode = '22023';
  end if;

  select r.status into v_room_status from public.rooms r where r.id = v_companion.room_id;
  if v_room_status <> 'open' then
    raise exception 'room is closed' using errcode = 'P0001';
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

create or replace function public.get_room_companions(p_room_id uuid)
returns table (
  player_id uuid,
  player_name text,
  player_role text,
  companion_id uuid,
  companion_state text,
  source_local_id text,
  source_nativa_id uuid,
  format_version integer,
  revision bigint,
  campaign_data jsonb,
  preview jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_is_master boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not nativa_private.is_room_member(p_room_id) then
    raise exception 'room member required' using errcode = '42501';
  end if;
  v_is_master := nativa_private.is_room_master(p_room_id);

  return query
  with active_slots as (
    select rm.user_id as member_id,
      coalesce(nullif(btrim(p.display_name), ''), 'Jogador') as member_name,
      rm.role as member_role,
      c.id as c_id,
      case when c.id is null then 'awaiting'::text else 'active'::text end as c_state,
      c.source_local_id as c_local_id,
      c.source_nativa_id as c_source_id,
      c.format_version as c_format_version,
      c.revision as c_revision,
      c.campaign_data as c_data,
      c.updated_at as c_updated_at
    from public.room_members rm
    left join public.profiles p on p.id = rm.user_id
    left join public.room_companions c
      on c.room_id = rm.room_id and c.player_id = rm.user_id and c.is_active
    where rm.room_id = p_room_id
  ),
  visible_rows as (
    select s.* from active_slots s
    union all
    select c.player_id,
      coalesce(nullif(btrim(p.display_name), ''), 'Jogador'),
      coalesce(rm.role, 'removed'::text),
      c.id,
      'history'::text,
      c.source_local_id,
      c.source_nativa_id,
      c.format_version,
      c.revision,
      c.campaign_data,
      c.updated_at
    from public.room_companions c
    left join public.room_members rm on rm.room_id = c.room_id and rm.user_id = c.player_id
    left join public.profiles p on p.id = c.player_id
    where c.room_id = p_room_id
      and not c.is_active
      and (v_is_master or c.player_id = v_user_id)
  )
  select
    r.member_id,
    r.member_name,
    r.member_role,
    case when v_is_master or r.member_id = v_user_id then r.c_id else null end,
    r.c_state,
    case when v_is_master or r.member_id = v_user_id then r.c_local_id else null end,
    case when v_is_master or r.member_id = v_user_id then r.c_source_id else null end,
    case when v_is_master or r.member_id = v_user_id then r.c_format_version else null end,
    case when v_is_master or r.member_id = v_user_id then r.c_revision else null end,
    case when v_is_master or r.member_id = v_user_id then r.c_data else null end,
    case
      when r.c_state = 'active' and r.c_id is not null
        and not (v_is_master or r.member_id = v_user_id)
      then jsonb_strip_nulls(jsonb_build_object(
        'name', r.c_data->'name',
        'species', r.c_data->'species',
        'groupBio', r.c_data->'groupBio',
        'lineage', r.c_data->'lineage',
        'lineageName', coalesce(r.c_data->'lineageName', r.c_data->'lineage'),
        'bioma', r.c_data->'bioma',
        'affinity', r.c_data->'affinity',
        'archetype', r.c_data->'archetype'
      ))
      else null
    end,
    case when v_is_master or r.member_id = v_user_id then r.c_updated_at else null end
  from visible_rows r
  order by case when r.member_role = 'master' then 0 else 1 end, r.member_name, r.c_state;
end
$function$;

create or replace function public.update_room_name(p_room_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_creator uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'invalid room name' using errcode = '22023';
  end if;
  select r.created_by, r.status into v_creator, v_status
  from public.rooms r where r.id = p_room_id for update;
  if not found or v_creator <> auth.uid() or not nativa_private.is_room_master(p_room_id) then
    raise exception 'room master required' using errcode = '42501';
  end if;
  if v_status <> 'open' then
    raise exception 'room is closed' using errcode = 'P0001';
  end if;
  update public.rooms set name = btrim(p_name) where id = p_room_id;
  return btrim(p_name);
end
$function$;

create or replace function public.kick_room_player(p_room_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_creator uuid;
  v_role text;
  v_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select r.created_by into v_creator from public.rooms r where r.id = p_room_id for update;
  if not found or v_creator <> auth.uid() or not nativa_private.is_room_master(p_room_id) then
    raise exception 'room master required' using errcode = '42501';
  end if;
  if p_player_id is null or p_player_id = v_creator then
    raise exception 'room master cannot be removed' using errcode = '42501';
  end if;

  select rm.role into v_role from public.room_members rm
  where rm.room_id = p_room_id and rm.user_id = p_player_id
  for update;
  if not found or v_role <> 'player' then
    raise exception 'room player not found' using errcode = 'P0002';
  end if;

  update public.room_companions c
  set is_active = false, retired_at = coalesce(c.retired_at, now()), updated_at = now()
  where c.room_id = p_room_id and c.player_id = p_player_id and c.is_active;
  delete from public.room_members rm where rm.room_id = p_room_id and rm.user_id = p_player_id;

  update public.room_state rs
  set revision = rs.revision + 1, updated_by = auth.uid(), updated_at = now()
  where rs.room_id = p_room_id
  returning rs.revision into v_revision;
  if not found then
    raise exception 'room state not found' using errcode = '55000';
  end if;
  insert into public.room_events (room_id, revision, actor_id, event_type, payload)
  values (p_room_id, v_revision, auth.uid(), 'participant_removed', jsonb_build_object('player_id', p_player_id));
end
$function$;

create or replace function public.close_room(p_room_id uuid, p_confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_creator uuid;
  v_name text;
  v_status text;
  v_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select r.created_by, r.name, r.status into v_creator, v_name, v_status
  from public.rooms r where r.id = p_room_id for update;
  if not found or v_creator <> auth.uid() or not nativa_private.is_room_master(p_room_id) then
    raise exception 'room master required' using errcode = '42501';
  end if;
  if p_confirmation is distinct from v_name then
    raise exception 'room name confirmation mismatch' using errcode = '22023';
  end if;
  if v_status = 'closed' then
    return;
  end if;

  update public.room_invites ri set revoked_at = coalesce(ri.revoked_at, now())
  where ri.room_id = p_room_id;
  update public.room_companions c
  set is_active = false, retired_at = coalesce(c.retired_at, now()), updated_at = now()
  where c.room_id = p_room_id and c.is_active;

  update public.room_state rs
  set revision = rs.revision + 1, updated_by = auth.uid(), updated_at = now()
  where rs.room_id = p_room_id
  returning rs.revision into v_revision;
  if not found then
    raise exception 'room state not found' using errcode = '55000';
  end if;
  insert into public.room_events (room_id, revision, actor_id, event_type, payload)
  values (p_room_id, v_revision, auth.uid(), 'room_closed', '{}'::jsonb);
  update public.rooms set status = 'closed' where id = p_room_id;
end
$function$;

-- Existing room-state writes and invitation creation must stop once a room is
-- closed, while the room and campaign records remain readable as history.
create or replace function public.update_room_state(
  p_room_id uuid,
  p_expected_revision bigint,
  p_state jsonb,
  p_event_type text,
  p_event_payload jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not nativa_private.is_room_master(p_room_id) then
    raise exception 'room master required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.rooms r where r.id = p_room_id and r.status = 'open') then
    raise exception 'room is closed' using errcode = 'P0001';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object'
    or p_event_payload is null or jsonb_typeof(p_event_payload) <> 'object'
    or p_event_type is null or char_length(p_event_type) not between 1 and 80 then
    raise exception 'invalid room state event' using errcode = '22023';
  end if;
  update public.room_state rs
  set state = p_state, revision = rs.revision + 1, updated_by = v_user_id, updated_at = now()
  where rs.room_id = p_room_id and rs.revision = p_expected_revision
  returning rs.revision into v_revision;
  if not found then
    raise exception 'room state revision conflict' using errcode = '40001';
  end if;
  insert into public.room_events (room_id, revision, actor_id, event_type, payload)
  values (p_room_id, v_revision, v_user_id, p_event_type, p_event_payload);
  return v_revision;
end
$function$;

create or replace function public.create_room_invite(
  p_room_id uuid,
  p_kind text,
  p_expires_at timestamptz,
  p_max_uses integer default 1
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token text;
  v_hash bytea;
  v_bytes integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not nativa_private.is_room_master(p_room_id) then
    raise exception 'room master required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.rooms r where r.id = p_room_id and r.status = 'open') then
    raise exception 'room is closed' using errcode = 'P0001';
  end if;
  if p_kind not in ('code', 'link') then
    raise exception 'invalid invite kind' using errcode = '22023';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'invite expiry must be in the future' using errcode = '22023';
  end if;
  if p_max_uses is null or p_max_uses < 1 then
    raise exception 'invite max uses must be positive' using errcode = '22023';
  end if;
  v_bytes := case when p_kind = 'code' then 16 else 32 end;
  v_token := translate(rtrim(encode(extensions.gen_random_bytes(v_bytes), 'base64'), '='), '+/', '-_');
  v_hash := extensions.digest(convert_to(v_token, 'UTF8'), 'sha256');
  insert into public.room_invites (room_id, kind, token_hash, created_by, expires_at, max_uses)
  values (p_room_id, p_kind, v_hash, auth.uid(), p_expires_at, p_max_uses);
  return v_token;
end
$function$;

revoke all on function nativa_private.can_view_shared_nativa(uuid) from public, anon;
revoke all on function nativa_private.can_view_room_companion_full(uuid, uuid) from public, anon;
grant execute on function nativa_private.can_view_shared_nativa(uuid) to authenticated;
grant execute on function nativa_private.can_view_room_companion_full(uuid, uuid) to authenticated;

revoke all on function public.choose_room_companion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_room_companion(uuid, bigint, integer, jsonb) from public, anon, authenticated;
revoke all on function public.get_room_companions(uuid) from public, anon, authenticated;
revoke all on function public.update_room_name(uuid, text) from public, anon, authenticated;
revoke all on function public.kick_room_player(uuid, uuid) from public, anon, authenticated;
revoke all on function public.close_room(uuid, text) from public, anon, authenticated;
revoke all on function public.update_room_state(uuid, bigint, jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_room_invite(uuid, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.choose_room_companion(uuid, uuid) to authenticated;
grant execute on function public.save_room_companion(uuid, bigint, integer, jsonb) to authenticated;
grant execute on function public.get_room_companions(uuid) to authenticated;
grant execute on function public.update_room_name(uuid, text) to authenticated;
grant execute on function public.kick_room_player(uuid, uuid) to authenticated;
grant execute on function public.close_room(uuid, text) to authenticated;
grant execute on function public.update_room_state(uuid, bigint, jsonb, text, jsonb) to authenticated;
grant execute on function public.create_room_invite(uuid, text, timestamptz, integer) to authenticated;
