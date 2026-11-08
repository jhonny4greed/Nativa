-- Per-room privacy for ficha shares. Existing links become private by default;
-- owners can explicitly make a ficha visible to ordinary room members.

alter table public.room_nativas
  add column visibility text not null default 'private'
    check (visibility in ('private', 'visible'));

create index room_nativas_room_visibility_idx
  on public.room_nativas (room_id, visibility, nativa_id);
create index room_nativas_nativa_visibility_room_idx
  on public.room_nativas (nativa_id, visibility, room_id);

-- The project does not currently use table-change subscriptions for ficha
-- data. Keep these tables out of Postgres Changes so a stale Realtime
-- authorization cache cannot continue streaming a newly private ficha.
do $migration$
declare
  v_all_tables boolean;
begin
  select p.puballtables into v_all_tables
  from pg_catalog.pg_publication p
  where p.pubname = 'supabase_realtime';

  if coalesce(v_all_tables, false) then
    raise exception 'supabase_realtime publishes all tables; exclude ficha tables before applying room privacy';
  end if;

  if exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nativas'
  ) then
    execute 'alter publication supabase_realtime drop table public.nativas';
  end if;
  if exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_nativas'
  ) then
    execute 'alter publication supabase_realtime drop table public.room_nativas';
  end if;
end
$migration$;

-- A room master may inspect every active ficha owned by a member of their
-- room, including private or not-yet-shared fichas. Ordinary members may only
-- inspect fichas explicitly marked visible in a room they belong to.
create or replace function nativa_private.can_view_shared_nativa(p_nativa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (
      select 1
      from public.nativas n
      join public.room_members owner_members
        on owner_members.user_id = n.owner_id
      join public.room_members viewer
        on viewer.room_id = owner_members.room_id
      where n.id = p_nativa_id
        and viewer.user_id = auth.uid()
        and viewer.role = 'master'
    )
    or exists (
      select 1
      from public.room_nativas rn
      join public.room_members viewer
        on viewer.room_id = rn.room_id
      where rn.nativa_id = p_nativa_id
        and rn.visibility = 'visible'
        and viewer.user_id = auth.uid()
    )
  );
$$;

drop policy if exists room_nativas_select_owner_or_master on public.room_nativas;
create policy room_nativas_select_owner_master_or_visible_member on public.room_nativas
for select to authenticated
using (
  owner_id = (select auth.uid())
  or nativa_private.is_room_master(room_id)
  or (
    visibility = 'visible'
    and nativa_private.is_room_member(room_id)
  )
);

-- The only mutable share field is visibility. RLS and the composite foreign
-- keys keep the operation scoped to the authenticated ficha owner and a room
-- in which they remain a member.
create policy room_nativas_update_owner_visibility on public.room_nativas
for update to authenticated
using (
  owner_id = (select auth.uid())
  and nativa_private.is_room_member(room_id)
  and exists (
    select 1 from public.nativas n
    where n.id = room_nativas.nativa_id
      and n.owner_id = (select auth.uid())
      and n.deleted_at is null
  )
)
with check (
  owner_id = (select auth.uid())
  and nativa_private.is_room_member(room_id)
  and exists (
    select 1 from public.nativas n
    where n.id = room_nativas.nativa_id
      and n.owner_id = (select auth.uid())
      and n.deleted_at is null
  )
);

revoke update on table public.room_nativas from public, anon, authenticated;
grant update (visibility) on table public.room_nativas to authenticated;
revoke all on function nativa_private.can_view_shared_nativa(uuid) from public, anon;
grant execute on function nativa_private.can_view_shared_nativa(uuid) to authenticated;
