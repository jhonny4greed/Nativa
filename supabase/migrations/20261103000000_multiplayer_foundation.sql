-- NATIVA multiplayer foundation: schema, atomic room operations and RLS.
-- This migration is intended for local/review use; it has not been applied
-- to any hosted Supabase project.

create extension if not exists pgcrypto with schema extensions;

-- Internal helpers are intentionally outside Supabase's exposed API schemas.
create schema if not exists nativa_private;
revoke all on schema nativa_private from public, anon, authenticated;
grant usage on schema nativa_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('master', 'player')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, user_id, role)
);
create index room_members_user_id_idx on public.room_members (user_id);

create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  kind text not null check (kind in ('code', 'link')),
  token_hash bytea not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0 and uses_count <= max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index room_invites_room_id_idx on public.room_invites (room_id);

-- data stores the complete existing local ficha object. local_id and
-- format_version let future sync preserve legacy IDs and schema versions.
create table public.nativas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  local_id text not null check (char_length(local_id) between 1 and 160),
  format_version integer not null default 1 check (format_version > 0),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, local_id),
  unique (id, owner_id)
);
create index nativas_owner_id_idx on public.nativas (owner_id);

create table public.room_nativas (
  room_id uuid not null,
  nativa_id uuid not null,
  owner_id uuid not null,
  shared_at timestamptz not null default now(),
  primary key (room_id, nativa_id),
  foreign key (room_id, owner_id)
    references public.room_members (room_id, user_id) on delete cascade,
  foreign key (nativa_id, owner_id)
    references public.nativas (id, owner_id) on delete cascade
);
create index room_nativas_owner_room_idx on public.room_nativas (owner_id, room_id);

create table public.room_state (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  updated_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table public.room_events (
  room_id uuid not null references public.room_state (room_id) on delete cascade,
  revision bigint not null check (revision >= 0),
  actor_id uuid not null references auth.users (id) on delete restrict,
  event_type text not null check (char_length(event_type) between 1 and 80),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (room_id, revision)
);

create table public.room_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  player_id uuid not null,
  member_role text not null default 'player' check (member_role = 'player'),
  turn_number integer not null check (turn_number > 0),
  action jsonb not null check (jsonb_typeof(action) = 'object'),
  created_at timestamptz not null default now(),
  unique (room_id, player_id, turn_number),
  foreign key (room_id, player_id, member_role)
    references public.room_members (room_id, user_id, role) on delete cascade
);
create index room_actions_room_turn_idx on public.room_actions (room_id, turn_number);

create or replace function public.nativa_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.nativa_set_updated_at();
create trigger nativas_set_updated_at
before update on public.nativas
for each row execute function public.nativa_set_updated_at();
create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.nativa_set_updated_at();

-- Security-definer predicates avoid RLS recursion while returning only a
-- boolean for the current authenticated user.
create or replace function nativa_private.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = auth.uid()
  );
$$;

create or replace function nativa_private.is_room_master(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = auth.uid()
      and rm.role = 'master'
  );
$$;

create or replace function nativa_private.can_view_shared_nativa(p_nativa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.room_nativas rn
    join public.room_members rm on rm.room_id = rn.room_id
    where rn.nativa_id = p_nativa_id
      and rm.user_id = auth.uid()
      and rm.role = 'master'
  );
$$;

create or replace function nativa_private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    p_profile_id = auth.uid() or exists (
      select 1
      from public.room_members mine
      join public.room_members peer on peer.room_id = mine.room_id
      where mine.user_id = auth.uid()
        and peer.user_id = p_profile_id
    )
  );
$$;

create or replace function public.create_room(p_name text, p_initial_state jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'invalid room name' using errcode = '22023';
  end if;
  if p_initial_state is null or jsonb_typeof(p_initial_state) <> 'object' then
    raise exception 'room state must be a JSON object' using errcode = '22023';
  end if;

  insert into public.rooms (created_by, name)
  values (v_user_id, btrim(p_name))
  returning id into v_room_id;

  -- These writes share one transaction: a room cannot exist without its master
  -- membership and recoverable initial state.
  insert into public.room_members (room_id, user_id, role)
  values (v_room_id, v_user_id, 'master');
  insert into public.room_state (room_id, revision, state, updated_by)
  values (v_room_id, 0, p_initial_state, v_user_id);
  insert into public.room_events (room_id, revision, actor_id, event_type, payload)
  values (v_room_id, 0, v_user_id, 'room_created', '{}'::jsonb);

  return v_room_id;
end;
$$;

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
as $$
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
  if p_kind not in ('code', 'link') then
    raise exception 'invalid invite kind' using errcode = '22023';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'invite expiry must be in the future' using errcode = '22023';
  end if;
  if p_max_uses is null or p_max_uses < 1 then
    raise exception 'invite max uses must be positive' using errcode = '22023';
  end if;

  -- 128-bit codes are suitable for manual entry; invitation links use 256 bits.
  v_bytes := case when p_kind = 'code' then 16 else 32 end;
  v_token := translate(
    rtrim(encode(extensions.gen_random_bytes(v_bytes), 'base64'), '='),
    '+/', '-_'
  );
  v_hash := extensions.digest(convert_to(v_token, 'UTF8'), 'sha256');

  insert into public.room_invites (room_id, kind, token_hash, created_by, expires_at, max_uses)
  values (p_room_id, p_kind, v_hash, auth.uid(), p_expires_at, p_max_uses);

  -- The raw token is returned once and is never stored in the database.
  return v_token;
end;
$$;

create or replace function public.join_room_with_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.room_invites%rowtype;
  v_inserted integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 80 then
    raise exception 'invalid or unavailable invite' using errcode = 'P0001';
  end if;

  select * into v_invite
  from public.room_invites ri
  where ri.token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
  for update;

  if not found then
    raise exception 'invalid or unavailable invite' using errcode = 'P0001';
  end if;

  -- Idempotent retry/reconnect: a lost response must not consume another use.
  if exists (
    select 1 from public.room_members rm
    where rm.room_id = v_invite.room_id and rm.user_id = v_user_id
  ) then
    return v_invite.room_id;
  end if;

  if v_invite.revoked_at is not null
    or v_invite.expires_at <= now()
    or v_invite.uses_count >= v_invite.max_uses
    or not exists (
      select 1 from public.rooms r
      where r.id = v_invite.room_id and r.status = 'open'
    ) then
    raise exception 'invalid or unavailable invite' using errcode = 'P0001';
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (v_invite.room_id, v_user_id, 'player')
  on conflict (room_id, user_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update public.room_invites
    set uses_count = uses_count + 1
    where id = v_invite.id;
  end if;

  return v_invite.room_id;
end;
$$;

create or replace function public.revoke_room_invite(p_room_id uuid, p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not nativa_private.is_room_master(p_room_id) then
    raise exception 'room master required' using errcode = '42501';
  end if;
  update public.room_invites
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invite_id and room_id = p_room_id;
  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
end;
$$;

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
as $$
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
  if p_state is null or jsonb_typeof(p_state) <> 'object'
    or p_event_payload is null or jsonb_typeof(p_event_payload) <> 'object'
    or p_event_type is null or char_length(p_event_type) not between 1 and 80 then
    raise exception 'invalid room state event' using errcode = '22023';
  end if;

  update public.room_state rs
  set state = p_state,
      revision = rs.revision + 1,
      updated_by = v_user_id,
      updated_at = now()
  where rs.room_id = p_room_id
    and rs.revision = p_expected_revision
  returning rs.revision into v_revision;

  if not found then
    raise exception 'room state revision conflict' using errcode = '40001';
  end if;

  insert into public.room_events (room_id, revision, actor_id, event_type, payload)
  values (p_room_id, v_revision, v_user_id, p_event_type, p_event_payload);

  return v_revision;
end;
$$;

-- RLS is enabled on every public application table. Table privileges are
-- explicitly revoked first; policies then grant row-scoped access.
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_invites enable row level security;
alter table public.nativas enable row level security;
alter table public.room_nativas enable row level security;
alter table public.room_state enable row level security;
alter table public.room_events enable row level security;
alter table public.room_actions enable row level security;

revoke all on table public.profiles, public.rooms, public.room_members,
  public.room_invites, public.nativas, public.room_nativas,
  public.room_state, public.room_events, public.room_actions
from public, anon, authenticated;

grant select on public.profiles, public.rooms, public.room_members,
  public.room_nativas, public.room_state, public.room_events to authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert (owner_id, local_id, format_version, data) on public.nativas to authenticated;
grant update (data, format_version) on public.nativas to authenticated;
grant delete on public.nativas to authenticated;
grant insert on public.room_nativas to authenticated;
grant delete on public.room_nativas to authenticated;

create policy profiles_select_self_or_room_peer on public.profiles
for select to authenticated
using (nativa_private.can_view_profile(id));
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy rooms_select_members on public.rooms
for select to authenticated
using (nativa_private.is_room_member(id));

create policy room_members_select_self_or_master on public.room_members
for select to authenticated
using (user_id = (select auth.uid()) or nativa_private.is_room_master(room_id));

-- No client policy/grant is created for room_invites. Only the narrowly scoped
-- security-definer functions can create, redeem, or revoke invite records.

create policy nativas_select_owner_or_shared_master on public.nativas
for select to authenticated
using (owner_id = (select auth.uid()) or nativa_private.can_view_shared_nativa(id));
create policy nativas_insert_owner on public.nativas
for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy nativas_update_owner on public.nativas
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create policy nativas_delete_owner on public.nativas
for delete to authenticated
using (owner_id = (select auth.uid()));

create policy room_nativas_select_owner_or_master on public.room_nativas
for select to authenticated
using (owner_id = (select auth.uid()) or nativa_private.is_room_master(room_id));
create policy room_nativas_insert_owner_member on public.room_nativas
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and nativa_private.is_room_member(room_id)
);
create policy room_nativas_delete_owner on public.room_nativas
for delete to authenticated
using (owner_id = (select auth.uid()));

create policy room_state_select_members on public.room_state
for select to authenticated
using (nativa_private.is_room_member(room_id));

create policy room_events_select_members on public.room_events
for select to authenticated
using (nativa_private.is_room_member(room_id));

-- Room actions are reserved for the later synchronization step. They have no
-- client table grants/policies yet; this migration only establishes the schema.

revoke all on function public.nativa_set_updated_at() from public, anon, authenticated;
revoke all on function nativa_private.is_room_member(uuid) from public, anon;
revoke all on function nativa_private.is_room_master(uuid) from public, anon;
revoke all on function nativa_private.can_view_shared_nativa(uuid) from public, anon;
revoke all on function nativa_private.can_view_profile(uuid) from public, anon;
revoke all on function public.create_room(text, jsonb) from public, anon, authenticated;
revoke all on function public.create_room_invite(uuid, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.join_room_with_invite(text) from public, anon, authenticated;
revoke all on function public.revoke_room_invite(uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_room_state(uuid, bigint, jsonb, text, jsonb) from public, anon, authenticated;

grant execute on function nativa_private.is_room_member(uuid) to authenticated;
grant execute on function nativa_private.is_room_master(uuid) to authenticated;
grant execute on function nativa_private.can_view_shared_nativa(uuid) to authenticated;
grant execute on function nativa_private.can_view_profile(uuid) to authenticated;
grant execute on function public.create_room(text, jsonb) to authenticated;
grant execute on function public.create_room_invite(uuid, text, timestamptz, integer) to authenticated;
grant execute on function public.join_room_with_invite(text) to authenticated;
grant execute on function public.revoke_room_invite(uuid, uuid) to authenticated;
grant execute on function public.update_room_state(uuid, bigint, jsonb, text, jsonb) to authenticated;
